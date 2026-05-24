import { useState, useEffect } from 'react';

import api from '../../utils/api';
import { Spinner, Warning, Bolt, Cross, Shield, User, UserMinus, Gavel, Door, Trash, Speaker } from '../Icons';

interface ChannelType {
  _id: string;
  name: string;
  type: 'text' | 'voice';
  description?: string;
}

interface CategoryType {
  _id: string;
  name: string;
  order: number;
  channels: ChannelType[];
}

interface ServerDetails {
  _id: string;
  name: string;
  icon?: string;
  banner?: string;
  owner?: any;
  admins?: any[];
  categories: CategoryType[];
}

interface ServerSidebarProps {
  serverId: string;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string, name: string, type: 'text' | 'voice') => void;
  onOpenSettings: () => void;
  open: boolean;
  onLeaveOrDelete?: (serverId: string) => void;
}

// Memory cache to hold server details when out of view
const serverDetailsCache: Record<string, ServerDetails> = {};

export default function ServerSidebar({
  serverId,
  activeChannelId,
  onSelectChannel,
  onOpenSettings,
  open,
  onLeaveOrDelete
}: ServerSidebarProps) {
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Track toggle states of categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Local storage user context
  const [currentUser, setCurrentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });

  const [activeVoiceState, setActiveVoiceState] = useState<any>(() => {
    return (window as any).__activeVoiceState || null;
  });

  useEffect(() => {
    const handleVoiceUsersUpdated = () => {
      setActiveVoiceState((window as any).__activeVoiceState || null);
    };
    const handleMuteSynced = (e: Event) => {
      const isMutedDetail = (e as CustomEvent).detail?.isMuted;
      setIsMuted(isMutedDetail);
    };

    window.addEventListener('voice-users-updated', handleVoiceUsersUpdated);
    window.addEventListener('voice-mute-synced', handleMuteSynced);
    return () => {
      window.removeEventListener('voice-users-updated', handleVoiceUsersUpdated);
      window.removeEventListener('voice-mute-synced', handleMuteSynced);
    };
  }, []);

  // Calculate Admin and Owner permissions at the top level
  const isOwner = server?.owner?._id 
    ? server.owner._id.toString() === currentUser._id?.toString()
    : server?.owner?.toString() === currentUser._id?.toString();

  const isAdmin = server?.admins?.some((admin: any) => {
    const adminId = admin._id ? admin._id.toString() : admin.toString();
    return adminId === currentUser._id?.toString();
  });

  const isServerAdminOrOwner = isOwner || isAdmin;

  // Track mic and deafen states locally for representation
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  // States for Admin Action Tester
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [adminStatusText, setAdminStatusText] = useState('');

  // States for Category and Channel creation
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [targetCategoryIdForChannel, setTargetCategoryIdForChannel] = useState('');

  const token = localStorage.getItem('token');

  // Fetch server details
  const fetchServerDetails = async () => {
    if (!token || !serverId) return;
    try {
      const res = await api.get(`/servers/${serverId}`);
      const data = res.data;
      if (data.success && data.server) {
        setServer(data.server);
        serverDetailsCache[serverId] = data.server;
        
        // Initialize expanded categories
        const expanded: Record<string, boolean> = {};
        data.server.categories.forEach((cat: CategoryType) => {
          expanded[cat._id] = true;
        });
        setExpandedCategories(expanded);

        // Auto-select first text channel if none is selected
        if (!activeChannelId) {
          let firstTextChannel: ChannelType | null = null;
          // Sort categories by order
          const sortedCats = [...data.server.categories].sort((a, b) => a.order - b.order);
          for (const cat of sortedCats) {
            const txtChan = cat.channels.find((c: ChannelType) => c.type === 'text');
            if (txtChan) {
              firstTextChannel = txtChan;
              break;
            }
          }
          if (firstTextChannel) {
            onSelectChannel(firstTextChannel._id, firstTextChannel.name, 'text');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load server details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await api.post(`/servers/${serverId}/categories`, { name: newCategoryName.trim() });
      if (res.data.success) {
        setShowCreateCategoryModal(false);
        setNewCategoryName('');
        await fetchServerDetails();
      } else {
        alert(res.data.error || 'Failed to create category');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create category');
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !targetCategoryIdForChannel) return;
    try {
      const res = await api.post(`/servers/${serverId}/channels`, {
        name: newChannelName.trim(),
        type: newChannelType,
        categoryId: targetCategoryIdForChannel
      });
      if (res.data.success) {
        setShowCreateChannelModal(false);
        setNewChannelName('');
        await fetchServerDetails();
        
        // Auto-select the newly created channel
        if (res.data.channel) {
          onSelectChannel(res.data.channel._id, res.data.channel.name, res.data.channel.type);
        }
      } else {
        alert(res.data.error || 'Failed to create channel');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create channel');
    }
  };

  const handleAdminAction = async (action: string) => {
    setAdminStatusText('');
    
    // Validations for targetUserId actions
    if (['promote', 'demote', 'kick', 'ban'].includes(action) && !targetUserId.trim()) {
      setAdminStatusText('❌ Error: Target User ID is required.');
      return;
    }

    const trimmedTargetId = targetUserId.trim();

    try {
      let res;
      let data;

      if (action === 'promote') {
        res = await api.post(`/servers/${serverId}/admins`, { userId: trimmedTargetId });
        data = res.data;
      } else if (action === 'demote') {
        res = await api.delete(`/servers/${serverId}/admins/${trimmedTargetId}`);
        data = res.data;
      } else if (action === 'kick') {
        if (!window.confirm('Are you sure you want to kick this member?')) return;
        res = await api.post(`/servers/${serverId}/kick/${trimmedTargetId}`);
        data = res.data;
      } else if (action === 'ban') {
        if (!window.confirm('Are you sure you want to permanently ban this member?')) return;
        res = await api.post(`/servers/${serverId}/ban/${trimmedTargetId}`);
        data = res.data;
      } else if (action === 'leave') {
        if (!window.confirm('Are you sure you want to leave this server?')) return;
        res = await api.post(`/servers/${serverId}/leave`);
        data = res.data;
        if (data.success) {
          alert('Successfully left the server.');
          if (onLeaveOrDelete) {
            onLeaveOrDelete(serverId);
          } else {
            localStorage.removeItem('api_cache:/servers');
            localStorage.removeItem(`api_cache:/servers/${serverId}`);
            localStorage.removeItem('activeServerId');
            localStorage.removeItem('activeChannelId');
            localStorage.removeItem(`lastActiveChannel_${serverId}`);
            localStorage.setItem('activeWorkspaceId', 'home');
            window.location.reload();
          }
          return;
        }
      } else if (action === 'delete') {
        if (!window.confirm('🚨 WARNING: Are you absolutely sure you want to DELETE this server? This action is permanent and cannot be undone.')) return;
        res = await api.delete(`/servers/${serverId}`);
        data = res.data;
        if (data.success) {
          alert('Server deleted successfully.');
          if (onLeaveOrDelete) {
            onLeaveOrDelete(serverId);
          } else {
            localStorage.removeItem('api_cache:/servers');
            localStorage.removeItem(`api_cache:/servers/${serverId}`);
            localStorage.removeItem('activeServerId');
            localStorage.removeItem('activeChannelId');
            localStorage.removeItem(`lastActiveChannel_${serverId}`);
            localStorage.setItem('activeWorkspaceId', 'home');
            window.location.reload();
          }
          return;
        }
      }

      if (data && data.success) {
        setAdminStatusText(`✅ Success: ${data.message || 'Action executed successfully!'}`);
        setTargetUserId('');
        // Reload details
        fetchServerDetails();
      } else {
        setAdminStatusText(`❌ Error: ${data?.error || 'Action failed.'}`);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Network error occurred.';
      setAdminStatusText(`❌ Error: ${errMsg}`);
    }
  };

  useEffect(() => {
    if (serverDetailsCache[serverId]) {
      setServer(serverDetailsCache[serverId]);
      setLoading(false);
    } else {
      setServer(null);
      setLoading(true);
    }
    fetchServerDetails();
  }, [serverId]);

  // Periodically sync user status or settings
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    };
    window.addEventListener('storage', handleStorageChange);
    const syncInterval = setInterval(() => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (JSON.stringify(u) !== JSON.stringify(currentUser)) {
        setCurrentUser(u);
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, [currentUser]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  if (loading) {
    return (
      <aside className={`dm-sidebar${open ? ' dm-sidebar--open' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Spinner size={16} color="#14AC7B" />
        <div style={{ color: '#8E9297', fontSize: '14px' }}>Loading channels...</div>
      </aside>
    );
  }

  if (!server) {
    return (
      <aside className={`dm-sidebar${open ? ' dm-sidebar--open' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Warning size={16} color="#ED4245" />
        <div style={{ color: '#ED4245', fontSize: '14px' }}>Server not found</div>
      </aside>
    );
  }

  // Sort categories by order
  const sortedCategories = [...server.categories].sort((a, b) => a.order - b.order);

  return (
    <>
      <aside className={`dm-sidebar${open ? ' dm-sidebar--open' : ''}`} style={{ display: 'flex', flexDirection: 'column', background: '#171E24', height: '100%' }}>
        {/* Server Title / Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onClick={() => setShowAdminMenu(true)}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <span style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '160px'
          }}>
            {server.name}
          </span>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#C7C9CB' }}>
            <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Channels scroll area */}
        <div className="dm-scroll-area" style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Categories Title Header */}
          <div 
            className="categories-title-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              color: '#8E9297',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            <span>Channels</span>
            {isServerAdminOrOwner && (
              <button
                className="category-add-main-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewCategoryName('');
                  setShowCreateCategoryModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8E9297',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#8E9297'}
                title="Create Category"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedCategories.map(cat => {
              return (
                <div key={cat._id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Category Header */}
                  <div 
                    className="category-header-wrap"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      userSelect: 'none',
                    }}
                  >
                    <div 
                      onClick={() => toggleCategory(cat._id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#8E9297',
                        cursor: 'pointer',
                        letterSpacing: '0.5px',
                        flex: 1
                      }}
                    >
                      <svg 
                        width="10" 
                        height="10" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="3"
                        style={{
                          transform: expandedCategories[cat._id] !== false ? 'rotate(0deg)' : 'rotate(-90deg)',
                          transition: 'transform 0.2s',
                          color: '#8E9297'
                        }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {cat.name}
                      </span>
                    </div>
                    
                    {isServerAdminOrOwner && (
                      <button
                        className="category-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetCategoryIdForChannel(cat._id);
                          setNewChannelName('');
                          setNewChannelType('text');
                          setShowCreateChannelModal(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#8E9297',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#8E9297'}
                        title="Create Channel"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Channels List */}
                  {expandedCategories[cat._id] !== false && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      {cat.channels && cat.channels.length > 0 ? (
                        cat.channels.map(channel => {
                          const isActive = activeChannelId === channel._id;
                          return (
                            <div key={channel._id}>
                              <div
                                onClick={() => onSelectChannel(channel._id, channel.name, channel.type)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  background: isActive ? '#14AC7B' : 'transparent',
                                  color: isActive ? '#fff' : '#8E9297',
                                  fontWeight: isActive ? '600' : 'normal',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                    e.currentTarget.style.color = '#fff';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#8E9297';
                                  }
                                }}
                              >
                                {channel.type === 'text' ? (
                                  <span style={{ fontSize: '18px', opacity: isActive ? 1 : 0.6, fontWeight: 'bold' }}>#</span>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isActive ? 1 : 0.6 }}>
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                  </svg>
                                )}
                                <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {channel.name}
                                </span>
                              </div>

                              {/* Active users listed under voice channel */}
                              {channel.type === 'voice' && activeVoiceState && activeVoiceState.channelId === channel._id && (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  paddingLeft: '16px',
                                  marginTop: '4px',
                                  marginBottom: '8px'
                                }}>
                                  {activeVoiceState.users && activeVoiceState.users.map((user: any) => (
                                    <div 
                                      key={user.userId} 
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(255, 255, 255, 0.02)'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                        {user.avatar ? (
                                          <img 
                                            src={user.avatar} 
                                            alt={user.displayName} 
                                            style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
                                          />
                                        ) : (
                                          <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: '#14AC7B',
                                            color: '#fff',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                          }}>
                                            {user.username ? user.username[0].toUpperCase() : 'U'}
                                          </div>
                                        )}
                                        <span style={{
                                          fontSize: '13px',
                                          color: '#C7C9CB',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          maxWidth: '120px'
                                        }}>
                                          {user.displayName || user.username}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {!user.isMicOn && (
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8E9297', flexShrink: 0 }}>
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" opacity={0.5} />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" opacity={0.5} />
                                            <line x1="12" y1="19" x2="12" y2="23" opacity={0.5} />
                                            <line x1="8" y1="23" x2="16" y2="23" opacity={0.5} />
                                            <line x1="3" y1="3" x2="21" y2="21" stroke="#14AC7B" strokeWidth="3.5" />
                                          </svg>
                                        )}
                                        {user.isDeafened && (
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8E9297', flexShrink: 0 }}>
                                            <path d="M3 18v-6a9 9 0 0 1 18 0v6" opacity={0.5} />
                                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" opacity={0.5} />
                                            <line x1="3" y1="3" x2="21" y2="21" stroke="#14AC7B" strokeWidth="3.5" strokeLinecap="round" />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '6px 20px', fontSize: '12px', color: '#6A737D', fontStyle: 'italic' }}>
                          No channels yet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom User Profile Section */}
        <div style={{
          background: '#0F1317',
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.03)'
        }}>
          {/* Avatar and details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
              {currentUser.avatar ? (
                <img 
                  src={currentUser.avatar} 
                  alt="My avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#14AC7B',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {currentUser.username ? currentUser.username[0].toUpperCase() : 'U'}
                </div>
              )}
              {/* Online status indicator dot */}
              <span 
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '2px solid #0F1317',
                  background: 
                    currentUser.userStatusPreference === 'dnd' ? '#ED4245' :
                    currentUser.userStatusPreference === 'idle' ? '#FAA61A' :
                    currentUser.userStatusPreference === 'offline' ? '#747F8D' : '#3BA55D'
                }}
              />
            </div>
            
            {/* User credentials */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
              <span style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '90px'
              }}>
                {currentUser.displayName || currentUser.username || 'User'}
              </span>
              <span style={{
                fontSize: '11px',
                color: '#8E9297',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '90px'
              }}>
                @{currentUser.username || 'username'}
              </span>
            </div>
          </div>

          {/* Action buttons (Mute, Deafen, Settings) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {/* Microphone toggle */}
            <button 
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                window.dispatchEvent(new CustomEvent('voice-mute-toggled', { detail: { isMuted: nextMuted } }));
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: isMuted ? '#ED4245' : '#C7C9CB',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? (
                // Muted Microphone Icon with red slash
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              ) : (
                // Normal Microphone Icon
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>

            {/* Headphones deafen toggle */}
            <button 
              onClick={() => {
                const nextDeafened = !isDeafened;
                setIsDeafened(nextDeafened);
                window.dispatchEvent(new CustomEvent('voice-deafen-toggled', { detail: { isDeafened: nextDeafened } }));
                if (nextDeafened) {
                  setIsMuted(true);
                  window.dispatchEvent(new CustomEvent('voice-mute-toggled', { detail: { isMuted: true } }));
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: isDeafened ? '#ED4245' : '#C7C9CB',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
            >
              {isDeafened ? (
                // Deafened Headphones Icon with slash
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 7.72-8.9"></path>
                  <path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-7a9 9 0 0 0-6.14-8.52"></path>
                </svg>
              ) : (
                // Normal Headphones Icon
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
              )}
            </button>

            {/* Settings Button */}
            <button 
              onClick={onOpenSettings}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: '#C7C9CB',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              title="User Settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Admin Action Tester Modal */}
      {showAdminMenu && (() => {
        const isOwner = server?.owner?._id 
          ? server.owner._id.toString() === currentUser._id?.toString()
          : server?.owner?.toString() === currentUser._id?.toString();

        const isAdmin = server?.admins?.some((admin: any) => {
          const adminId = admin._id ? admin._id.toString() : admin.toString();
          return adminId === currentUser._id?.toString();
        });

        const isServerAdminOrOwner = isOwner || isAdmin;

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            fontFamily: 'Inter, sans-serif'
          }}>
            <div style={{
              width: '580px',
              background: '#171E24',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#1E262F'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bolt size={20} color="#FAA61A" />
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>Server Settings & Actions</h3>
                </div>
                <button 
                  onClick={() => { setShowAdminMenu(false); setTargetUserId(''); setAdminStatusText(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8E9297',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Cross size={18} color="#8E9297" />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {isServerAdminOrOwner ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#8E9297', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        Target User ID
                      </label>
                      <input 
                        type="text"
                        placeholder="Paste member _id here"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        style={{
                          background: '#0D1114',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          padding: '12px',
                          color: '#fff',
                          fontSize: '13px',
                          outline: 'none',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* 6 Actions Grid (exactly like user screenshot) */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginTop: '8px'
                    }}>
                      {/* Promote to Admin */}
                      <button
                        onClick={() => handleAdminAction('promote')}
                        style={{
                          background: '#5865F2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '14px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Shield size={14} color="#fff" /> Promote to Admin
                      </button>
 
                      {/* Demote Admin */}
                      <button
                        onClick={() => handleAdminAction('demote')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '14px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                      >
                        <User size={14} color="#fff" /> Demote Admin
                      </button>
 
                      {/* Kick Member */}
                      <button
                        onClick={() => handleAdminAction('kick')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#fff',
                          borderRadius: '8px',
                          padding: '14px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                      >
                        <UserMinus size={14} color="#fff" /> Kick Member
                      </button>
 
                      {/* Ban Member */}
                      <button
                        onClick={() => handleAdminAction('ban')}
                        style={{
                          background: 'rgba(237, 66, 69, 0.1)',
                          border: '1px solid #ED4245',
                          color: '#ED4245',
                          borderRadius: '8px',
                          padding: '14px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
                      >
                        <Gavel size={14} color="#ED4245" /> Ban Member
                      </button>

                      {/* Leave Server */}
                      {!isOwner && (
                        <button
                          onClick={() => handleAdminAction('leave')}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#E67E22',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        >
                          <Door size={14} color="#E67E22" /> Leave Server
                        </button>
                      )}

                      {/* Delete Server */}
                      {isOwner && (
                        <button
                          onClick={() => handleAdminAction('delete')}
                          style={{
                            background: '#ED4245',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          <Trash size={14} color="#fff" /> Delete Server
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ color: '#8E9297', fontSize: '14px', margin: 0 }}>
                      You are currently a member of this server. You can choose to leave this server.
                    </p>
                    <button
                      onClick={() => handleAdminAction('leave')}
                      style={{
                        background: '#ED4245',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '14px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                      🚪 Leave Server
                    </button>
                  </div>
                )}

                {/* Status Output */}
                {adminStatusText && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#0D1114',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    color: adminStatusText.includes('Success') ? '#14AC7B' : '#ED4245',
                    fontSize: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    {adminStatusText}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Category Modal */}
      {showCreateCategoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#1E262F',
            width: '100%',
            maxWidth: '440px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 24px 16px 24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>Create Category</h3>
              <p style={{ margin: '4px 0 0 0', color: '#8E9297', fontSize: '13px' }}>
                Categories keep your server organized by grouping related channels together.
              </p>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: '#8E9297', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="new-category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  maxLength={32}
                  style={{
                    background: '#12181F',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#14AC7B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              background: '#171E26',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowCreateCategoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                style={{
                  background: '#14AC7B',
                  color: '#fff',
                  border: 'none',
                  cursor: newCategoryName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCategoryName.trim() ? 1 : 0.5,
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  transition: 'opacity 0.2s'
                }}
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#1E262F',
            width: '100%',
            maxWidth: '440px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '24px 24px 16px 24px' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>Create Channel</h3>
              <p style={{ margin: '4px 0 0 0', color: '#8E9297', fontSize: '13px' }}>
                Create a space where members can chat or talk.
              </p>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Channel Type Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: '#8E9297', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Channel Type
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Text Option */}
                  <div
                    onClick={() => setNewChannelType('text')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: newChannelType === 'text' ? 'rgba(20, 172, 123, 0.15)' : '#12181F',
                      border: newChannelType === 'text' ? '1px solid #14AC7B' : '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '24px', color: newChannelType === 'text' ? '#14AC7B' : '#8E9297', width: '20px', textAlign: 'center' }}>#</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Text</span>
                      <span style={{ color: '#8E9297', fontSize: '12px' }}>Post messages, images, opinions, and puns</span>
                    </div>
                  </div>
                  {/* Voice Option */}
                  <div
                    onClick={() => setNewChannelType('voice')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: newChannelType === 'voice' ? 'rgba(20, 172, 123, 0.15)' : '#12181F',
                      border: newChannelType === 'voice' ? '1px solid #14AC7B' : '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: newChannelType === 'voice' ? '#14AC7B' : '#8E9297' }}>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>Voice</span>
                      <span style={{ color: '#8E9297', fontSize: '12px' }}>Hang out together with voice, video, and screen share</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Channel Name Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ color: '#8E9297', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Channel Name
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8E9297',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    {newChannelType === 'text' ? <span style={{ fontSize: '18px', fontWeight: 'bold' }}>#</span> : <Speaker size={16} />}
                  </span>
                  <input
                    type="text"
                    placeholder="new-channel"
                    value={newChannelName}
                    onChange={(e) => {
                      // format name to discord standard: lowercase, replacing spaces with dashes
                      const val = e.target.value.toLowerCase().replace(/\s+/g, '-');
                      setNewChannelName(val);
                    }}
                    maxLength={32}
                    style={{
                      background: '#12181F',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      padding: '10px 12px 10px 32px',
                      color: '#fff',
                      fontSize: '15px',
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#14AC7B'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateChannel();
                    }}
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              background: '#171E26',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim()}
                style={{
                  background: '#14AC7B',
                  color: '#fff',
                  border: 'none',
                  cursor: newChannelName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newChannelName.trim() ? 1 : 0.5,
                  fontSize: '14px',
                  fontWeight: 'bold',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  transition: 'opacity 0.2s'
                }}
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
