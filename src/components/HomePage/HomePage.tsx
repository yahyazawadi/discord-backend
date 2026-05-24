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
    const savedSelected = localStorage.getItem('selectedServerId');
    if (savedSelected) {
      localStorage.removeItem('selectedServerId');
      localStorage.setItem('activeWorkspaceId', savedSelected);
      return savedSelected;
    }
    const savedActive = localStorage.getItem('activeWorkspaceId');
    return savedActive || 'home';
  });

  const [activeDmId, setActiveDmId] = useState<string | null>(() => {
    const saved = localStorage.getItem('lastActiveDm');
    if (saved) {
      try {
        return JSON.parse(saved).id;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [activeDmName, setActiveDmName] = useState<string>(() => {
    const saved = localStorage.getItem('lastActiveDm');
    if (saved) {
      try {
        return JSON.parse(saved).name || 'Katara';
      } catch {
        return 'Katara';
      }
    }
    return 'Katara';
  });
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(() => {
    const saved = localStorage.getItem('lastActiveDm');
    if (saved) {
      try {
        return JSON.parse(saved).userId || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [activeDmAvatar, setActiveDmAvatar] = useState<string | null>(() => {
    const saved = localStorage.getItem('lastActiveDm');
    if (saved) {
      try {
        return JSON.parse(saved).avatar || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serversRefreshTrigger, setServersRefreshTrigger] = useState(0);

  // States for active server channels
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    const savedActive = localStorage.getItem('activeWorkspaceId') || 'home';
    if (savedActive !== 'home' && savedActive !== 'discover') {
      const savedChannel = localStorage.getItem(`lastActiveChannel_${savedActive}`);
      if (savedChannel) {
        try {
          return JSON.parse(savedChannel).id;
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [activeChannelName, setActiveChannelName] = useState<string>(() => {
    const savedActive = localStorage.getItem('activeWorkspaceId') || 'home';
    if (savedActive !== 'home' && savedActive !== 'discover') {
      const savedChannel = localStorage.getItem(`lastActiveChannel_${savedActive}`);
      if (savedChannel) {
        try {
          return JSON.parse(savedChannel).name || 'general';
        } catch {
          return 'general';
        }
      }
    }
    return 'general';
  });
  const [activeChannelType, setActiveChannelType] = useState<'text' | 'voice'>(() => {
    const savedActive = localStorage.getItem('activeWorkspaceId') || 'home';
    if (savedActive !== 'home' && savedActive !== 'discover') {
      const savedChannel = localStorage.getItem(`lastActiveChannel_${savedActive}`);
      if (savedChannel) {
        try {
          return JSON.parse(savedChannel).type || 'text';
        } catch {
          return 'text';
        }
      }
    }
    return 'text';
  });

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
    localStorage.setItem('activeWorkspaceId', id);
    setShowSettings(false); // Close settings when switching workspace context
    if (id !== 'home' && id !== 'discover') {
      const savedChannel = localStorage.getItem(`lastActiveChannel_${id}`);
      if (savedChannel) {
        try {
          const parsed = JSON.parse(savedChannel);
          setActiveChannelId(parsed.id);
          setActiveChannelName(parsed.name);
          setActiveChannelType(parsed.type);
        } catch (e) {
          setActiveChannelId(null);
          setActiveChannelName('general');
          setActiveChannelType('text');
        }
      } else {
        setActiveChannelId(null);
        setActiveChannelName('general');
        setActiveChannelType('text');
      }
      setActiveDmUserId(null); // Hide direct message profile panel
    }
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveId('home');
    localStorage.setItem('activeWorkspaceId', 'home');
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
      <SideNavbar activeId={activeId} setActiveId={handleSelectSideItem} refreshTrigger={serversRefreshTrigger} />
      {activeId === 'discover' ? (
        <DiscoverArea 
          onJoinServer={(serverId) => {
            setServersRefreshTrigger(prev => prev + 1);
            handleSelectSideItem(serverId);
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
                  
                  // Save last active DM
                  localStorage.setItem('lastActiveDm', JSON.stringify({ id, name, userId, avatar }));
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
                
                // Save last active channel
                localStorage.setItem(`lastActiveChannel_${activeId}`, JSON.stringify({ id: channelId, name, type }));
                
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

