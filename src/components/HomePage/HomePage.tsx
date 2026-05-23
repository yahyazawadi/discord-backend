import { useState, useEffect } from 'react';
import SideNavbar from './SideNavbar';
import DMSidebar from './DMSidebar';
import ServerSidebar from './ServerSidebar';
import ChatArea from './ChatArea';
import UserProfilePanel from './UserProfilePanel';
import ServerProfilePanel from './ServerProfilePanel';
import DiscoverArea from './DiscoverArea';
import UserSettingsArea from './UserSettingsArea';
import { connectSocket, disconnectSocket, getSocket } from '../../utils/socket';
import { Phone, PhoneOff } from '../Icons';
import './HomePage.css';

interface IncomingCall {
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  type: 'audio' | 'video';
}

export default function HomePage() {
  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem('selectedServerId');
    if (saved) {
      localStorage.removeItem('selectedServerId');
      return saved;
    }
    return 'home';
  });
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [activeDmName, setActiveDmName] = useState<string>('Katara');
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [activeDmAvatar, setActiveDmAvatar] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // States for active server channels
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string>('general');
  const [activeChannelType, setActiveChannelType] = useState<'text' | 'voice'>('text');

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [initialCallType, setInitialCallType] = useState<'audio' | 'video' | null>(null);
  // Triggered by UserProfilePanel call buttons -> forwarded to ChatArea
  const [pendingProfileCallType, setPendingProfileCallType] = useState<'audio' | 'video' | null>(null);

  const handleStartCallFromProfile = (type: 'audio' | 'video') => {
    setPendingProfileCallType(type);
  };

  // Initialize and maintain stable socket connection on page load, and handle call signaling
  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const handleIncomingCall = (data: IncomingCall) => {
      console.log('[HomePage] Incoming call event:', data);
      setIncomingCall(data);
    };

    const handleCallDeclined = (data: { conversationId: string; userId: string }) => {
      console.log('[HomePage] Call declined event:', data);
      setIncomingCall((prev) => {
        if (prev && prev.conversationId === data.conversationId) {
          return null;
        }
        return prev;
      });
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_declined', handleCallDeclined);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_declined', handleCallDeclined);
      disconnectSocket();
    };
  }, []);

  const handleSelectSideItem = (id: string) => {
    setActiveId(id);
    setShowSettings(false); // Close settings when switching workspace context
    if (id !== 'home' && id !== 'discover') {
      setActiveChannelId(null);
      setActiveDmUserId(null); // Hide direct message profile panel
    }
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveId('home');
    setActiveDmId(incomingCall.conversationId);
    setActiveDmName(incomingCall.callerName);
    setActiveDmUserId(incomingCall.callerId);
    setActiveDmAvatar(incomingCall.callerAvatar);
    setInitialCallType(incomingCall.type);
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    if (!incomingCall) return;
    const socket = getSocket();
    socket.emit('decline_call', { conversationId: incomingCall.conversationId });
    setIncomingCall(null);
  };

  return (
    <div className="home-page">
      <SideNavbar activeId={activeId} setActiveId={handleSelectSideItem} />
      {activeId === 'discover' ? (
        <DiscoverArea 
          onJoinServer={() => {
            handleSelectSideItem('home');
          }} 
        />
      ) : (
        <>
          {activeId === 'home' ? (
            <DMSidebar
              activeDmId={activeDmId}
              onSelectDm={(id, name, userId, avatar) => {
                if (activeDmId === id) {
                  // Clicked active DM again: toggle profile panel visibility
                  setActiveDmUserId((prev) => (prev ? null : (userId || null)));
                } else {
                  // Clicked a different DM: select and display profile
                  setActiveDmId(id);
                  setActiveDmName(name);
                  setActiveDmUserId(userId || null);
                  setActiveDmAvatar(avatar || null);
                }
                setSidebarOpen(false);
                setShowSettings(false); // Close settings when selecting DMs
              }}
              onOpenSettings={() => setShowSettings(true)}
              open={sidebarOpen}
            />
          ) : (
            <ServerSidebar
              serverId={activeId}
              activeChannelId={activeChannelId}
              onSelectChannel={(channelId, name, type) => {
                setActiveChannelId(channelId);
                setActiveChannelName(name);
                setActiveChannelType(type);
                setSidebarOpen(false);
                setShowSettings(false);
              }}
              onOpenSettings={() => setShowSettings(true)}
              open={sidebarOpen}
            />
          )}

          {showSettings ? (
            <UserSettingsArea onClose={() => setShowSettings(false)} />
          ) : (
            <>
              <ChatArea 
                conversationId={activeId === 'home' ? activeDmId : null} 
                channelId={activeId === 'home' ? null : activeChannelId}
                recipientName={activeId === 'home' ? activeDmName : activeChannelName} 
                recipientAvatar={activeId === 'home' ? activeDmAvatar : null}
                initialCallType={activeId === 'home' ? (pendingProfileCallType || initialCallType) : null}
                onClearInitialCallType={() => { setInitialCallType(null); setPendingProfileCallType(null); }}
                isVoice={activeId !== 'home' && activeChannelType === 'voice'}
              />
              {activeId === 'home' ? (
                <UserProfilePanel userId={activeDmUserId} onStartCall={activeDmId ? handleStartCallFromProfile : undefined} />
              ) : activeChannelType === 'voice' && activeChannelId ? (
                null
              ) : (
                <ServerProfilePanel serverId={activeId} />
              )}
            </>
          )}
        </>
      )}

      {incomingCall && (
        <div className="incoming-call-overlay">
          {incomingCall.callerAvatar ? (
            <img src={incomingCall.callerAvatar} alt="Caller avatar" className="incoming-call-avatar" />
          ) : (
            <div className="incoming-call-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#14ac7b', color: '#fff', fontSize: '28px', fontWeight: 'bold' }}>
              {incomingCall.callerName[0].toUpperCase()}
            </div>
          )}
          <div className="incoming-call-name">{incomingCall.callerName}</div>
          <div className="incoming-call-label">Incoming {incomingCall.type === 'video' ? 'video' : 'voice'} call...</div>
          <div className="incoming-call-actions">
            <button className="incoming-call-btn incoming-call-btn--accept" onClick={handleAcceptCall}>
              <Phone size={14} color="#fff" /> Accept
            </button>
            <button className="incoming-call-btn incoming-call-btn--decline" onClick={handleDeclineCall}>
              <PhoneOff size={14} color="#fff" /> Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

