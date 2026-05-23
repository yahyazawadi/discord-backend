import { useState, useEffect } from 'react';

import api from '../../utils/api';

export type StatusType = 'online' | 'idle' | 'dnd' | 'offline' | 'streaming' | 'mobile';

export interface DMUser {
  id: string; // Conversation ID
  userId: string; // Recipient User ID
  name: string;
  avatar?: string;
  status: StatusType;
  color: string;
}

function StatusBadge({ status }: { status: StatusType }) {
  if (status === 'online') {
    return <span className="status-online" />;
  }
  if (status === 'idle') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99514 9.99976C7.75911 9.99976 9.99976 7.75911 9.99976 4.99514C9.99976 2.33546 7.92501 0.160359 5.30569 0C5.93743 0.671693 6.32449 1.57616 6.32449 2.57103C6.32449 4.64401 4.64401 6.32449 2.57103 6.32449C1.57616 6.32449 0.671693 5.93743 0 5.30569C0.16036 7.92502 2.33546 9.99976 4.99514 9.99976Z"
          fill="#FAA61A"
        />
      </svg>
    );
  }
  if (status === 'dnd') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99993 0C2.23854 0 0 2.23854 0 4.99993C0 7.76131 2.23854 9.99985 4.99993 9.99985C7.76131 9.99985 9.99985 7.76131 9.99985 4.99993C9.99985 2.23854 7.76131 0 4.99993 0ZM2.5 4C1.94772 4 1.5 4.44772 1.5 5C1.5 5.55228 1.94772 6 2.5 6H7.5C8.05228 6 8.5 5.55228 8.5 5C8.5 4.44772 8.05229 4 7.5 4H2.5Z"
          fill="#ED4245"
        />
      </svg>
    );
  }
  if (status === 'offline') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 0C2.23858 0 0 2.23858 0 5C0 7.76142 2.23858 10 5 10C7.76142 10 10 7.76142 10 5C10 2.23858 7.76142 0 5 0ZM5 2.5C3.61929 2.5 2.5 3.61929 2.5 5C2.5 6.38071 3.61929 7.5 5 7.5C6.38071 7.5 7.5 6.38071 7.5 5C7.5 3.61929 6.38071 2.5 5 2.5Z"
          fill="#747F8D"
        />
      </svg>
    );
  }
  if (status === 'streaming') {
    return (
      <svg className="status-badge" width="12" height="12" viewBox="0 0 10 10" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.99993 0C2.23854 0 0 2.23854 0 4.99993C0 7.76131 2.23854 9.99985 4.99993 9.99985C7.76131 9.99985 9.99985 7.76131 9.99985 4.99993C9.99985 2.23854 7.76131 0 4.99993 0ZM7.5 5L3.5 2.5V7.5L7.5 5Z"
          fill="#593695"
        />
      </svg>
    );
  }
  if (status === 'mobile') {
    return (
      <svg className="status-badge status-badge--mobile" width="10" height="14" viewBox="0 0 10 15" fill="none">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M0 2C0 0.895416 0.895432 0 2 0H8C9.10457 0 10 0.895416 10 2V13C10 14.1046 9.10457 15 8 15H2C0.895432 15 0 14.1046 0 13V2ZM1.5 3C1.5 2.44772 1.94772 2 2.5 2H7.5C8.05229 2 8.5 2.44772 8.5 3V9C8.5 9.55228 8.05229 10 7.5 10H2.5C1.94772 10 1.5 9.55228 1.5 9V3ZM4.5 11.5C3.67157 11.5 3 11.6716 3 12.5C3 13.3284 3.67157 13.5 4.5 13.5H5.5C6.32843 13.5 7 13.3284 7 12.5C7 11.6716 6.32843 11.5 5.5 11.5H4.5Z"
          fill="#3BA55D"
        />
      </svg>
    );
  }
  return null;
}

const GRADIENTS = [
  '#9b59b6', '#e67e22', '#3498db', '#795548', '#1a252f', '#c0392b', '#576574'
];

const getColorForUser = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
};

interface DMSidebarProps {
  activeDmId: string | null;
  onSelectDm: (id: string, name: string, userId?: string, avatar?: string) => void;
  onOpenSettings: () => void;
  open: boolean;
}

export default function DMSidebar({ activeDmId, onSelectDm, onOpenSettings, open }: DMSidebarProps) {
  const [conversations, setConversations] = useState<DMUser[]>([]);
  
  // Search state triggers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Profile preference status from local storage
  const [currentUser, setCurrentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });

  const token = localStorage.getItem('token');

  // Fetch active direct message conversations
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await api.get('/messages/conversations');
      const data = res.data;
      if (data.success && Array.isArray(data.conversations)) {
        const mapped = data.conversations.map((c: any) => {
          const recipient = c.participants.find((p: any) => p._id !== currentUser._id) || currentUser;
          
          let status: StatusType = 'offline';
          if (recipient.userStatusPreference === 'auto') {
            status = (recipient.systemStatus || 'offline') as StatusType;
          } else {
            status = (recipient.userStatusPreference || 'offline') as StatusType;
          }

          return {
            id: c._id,
            userId: recipient._id,
            name: recipient.displayName || recipient.username,
            avatar: recipient.avatar,
            status,
            color: getColorForUser(recipient.username)
          };
        });
        setConversations(mapped);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Fetch all users for Find Conversation
  const fetchUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await api.get('/auth/users');
      const data = res.data;
      if (data.success) {
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load user catalog:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      fetchUsers();
    }
  }, [isSearchOpen]);

  // Sync current user context occasionally from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}'));
    };
    window.addEventListener('storage', handleStorageChange);
    // Local updates occasionally check
    const syncInterval = setInterval(() => {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (JSON.stringify(u) !== JSON.stringify(currentUser)) {
        setCurrentUser(u);
      }
    }, 1500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(syncInterval);
    };
  }, [currentUser]);

  // Create or select conversation
  const handleSelectUser = async (userId: string) => {
    try {
      const res = await api.post('/messages/conversations', { recipientId: userId });
      const data = res.data;
      if (data.success && data.conversation) {
        setIsSearchOpen(false);
        setSearchQuery('');
        await fetchConversations();
        const recipient = data.conversation.participants.find((p: any) => p._id !== currentUser._id) || currentUser;
        onSelectDm(data.conversation._id, recipient.displayName || recipient.username, recipient._id, recipient.avatar);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const filteredUsers = usersList.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <aside className={`dm-sidebar${open ? ' dm-sidebar--open' : ''}`}>
        {/* Find a Conversation header */}
        <div className="dm-find-bar" onClick={() => setIsSearchOpen(true)} style={{ cursor: 'pointer' }}>
          <svg className="dm-find-icon" width="21" height="17" viewBox="0 0 21 17" fill="none">
            <path
              d="M3.77528 0H0C0 8.62319 3.77528 11.744 5.66292 12.0725V17H21C21 10.5942 16.2809 10.5942 12.9775 10.5942C5.66292 10.5942 3.77528 4.43478 3.77528 0Z"
              fill="white"
            />
            <path
              d="M12.9775 0.5C18.6405 0.5 18.6405 9.12319 12.9775 9.12319C7.0867 9.12319 7.31461 0.5 12.9775 0.5Z"
              fill="white"
            />
          </svg>
          <span className="dm-find-text">Find a conversation</span>
        </div>

        {/* Active indicator underline */}
        <div className="dm-active-indicator" />

        {/* DM list scroll area */}
        <div className="dm-scroll-area">
          <div className="dm-section-heading">
            <span className="dm-section-title">Direct Messages</span>
            <button 
              className="dm-section-add-btn" 
              aria-label="New Direct Message"
              onClick={() => setIsSearchOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6.23388 0H4.98388V4.9825H0V6.2325H4.98388V11.2277H6.23388V6.2325H11.2264V4.9825H6.23388V0Z"
                  fill="#14AC7B"
                />
              </svg>
            </button>
          </div>

          <div className="dm-user-list">
            {conversations.length === 0 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: '#8E9297', fontSize: '13px' }}>
                No active conversations. Start one by clicking + or searching above!
              </div>
            ) : (
              conversations.map((user) => (
                <div
                  key={user.id}
                  className={`dm-user-item${activeDmId === user.id ? ' dm-user-item--active' : ''}`}
                  onClick={() => onSelectDm(user.id, user.name, user.userId, user.avatar)}
                >
                  <div className="dm-avatar-wrapper">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div className="dm-avatar-circle" style={{ background: user.color }}>
                        {user.name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="dm-status-badge">
                      <StatusBadge status={user.status} />
                    </span>
                  </div>
                  <span className="dm-username">{user.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom profile bar */}
        <div className="dm-user-profile-bar">
          <div className="dm-profile-avatar-wrap">
            {currentUser.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt="My avatar" 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <div className="dm-profile-avatar">
                {currentUser.username ? currentUser.username[0].toUpperCase() : 'U'}
              </div>
            )}
            <span 
              className="dm-profile-online-dot" 
              style={{
                background: 
                  currentUser.userStatusPreference === 'dnd' ? '#ED4245' :
                  currentUser.userStatusPreference === 'idle' ? '#FAA61A' :
                  currentUser.userStatusPreference === 'offline' ? '#747F8D' : '#3BA55D'
              }}
            />
          </div>
          <div className="dm-profile-info">
            <span className="dm-profile-name">{currentUser.displayName || currentUser.username || 'User'}</span>
            <span className="dm-profile-discriminator">@{currentUser.username}</span>
          </div>
          <div className="dm-profile-actions">
            {/* Mic */}
            <button className="dm-profile-action-btn" aria-label="Toggle Microphone">
              <svg width="14" height="17" viewBox="0 0 12 17" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8.56286 8.05263C8.56286 9.5379 7.42286 10.7368 6 10.7368C4.57714 10.7368 3.42857 9.5379 3.42857 8.05263V2.68421C3.42857 1.19895 4.57714 0 6 0C7.42286 0 8.57143 1.19895 8.57143 2.68421L8.56286 8.05263ZM6 12.6158C8.36571 12.6158 10.5429 10.7368 10.5429 8.05263H12C12 11.1126 9.66857 13.6358 6.85714 14.0653V17H5.14286V14.0653C2.33143 13.6268 0 11.1037 0 8.05263H1.45714C1.45714 10.7368 3.63429 12.6158 6 12.6158Z"
                  fill="#C7C9CB"
                />
              </svg>
            </button>
            {/* Headphones */}
            <button className="dm-profile-action-btn" aria-label="Toggle Headphones">
              <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
                <path
                  d="M8 0.5C3.5888 0.5 0 4.088 0 8.5V14.9C0 15.7832 0.716 16.5 1.6 16.5H3.2C4.0832 16.5 4.8 15.7832 4.8 14.9V12.5C4.8 11.6168 4.0832 10.9 3.2 10.9H1.6V8.5C1.6 4.97039 4.4712 2.1 8 2.1C11.5288 2.1 14.4 4.97039 14.4 8.5V10.9H12.8C11.9168 10.9 11.2 11.6168 11.2 12.5V14.9C11.2 15.7832 11.9168 16.5 12.8 16.5H14.4C15.2832 16.5 16 15.7832 16 14.9V8.5C16 4.088 12.4112 0.5 8 0.5Z"
                  fill="#C7C9CB"
                />
              </svg>
            </button>
            {/* Settings */}
            <button 
              className="dm-profile-action-btn" 
              aria-label="User Settings"
              onClick={onOpenSettings}
            >
              <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M14.1904 6.9H16V10.1H14.1912C14.0016 10.8448 13.68 11.5384 13.252 12.1512L14.4 13.3L12.8 14.9L11.652 13.7512C11.0376 14.1792 10.3456 14.4984 9.6 14.6904V16.5H6.4V14.6904C5.6552 14.4984 4.9624 14.1792 4.3488 13.7512L3.2 14.9L1.6 13.3L2.7488 12.1512C2.3208 11.5392 2.0016 10.8456 1.8096 10.1H0V6.9H1.8096C2.0016 6.1544 2.32 5.4616 2.7488 4.8488L1.6 3.7L3.2 2.1L4.3488 3.2488C4.9616 2.82 5.6544 2.5016 6.4 2.3096V0.5H9.6V2.3088C10.3456 2.5016 11.0376 2.82 11.652 3.248L12.8 2.0992L14.4 3.6992L13.2512 4.8488C13.6792 5.4616 13.9984 6.1552 14.1904 6.9ZM8 11.7C9.7673 11.7 11.2 10.2673 11.2 8.5C11.2 6.73269 9.7673 5.3 8 5.3C6.2327 5.3 4.8 6.73269 4.8 8.5C4.8 10.2673 6.2327 11.7 8 11.7Z"
                  fill="#C7C9CB"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Find/Start Direct Message Modal */}
      {isSearchOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(9, 12, 15, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          className="dm-modal-overlay"
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            style={{
              width: '460px',
              background: '#171E24',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              color: '#fff',
              position: 'relative'
            }}
            className="dm-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Find Conversation</h3>
              <p style={{ fontSize: '12px', color: '#8E9297', margin: 0 }}>
                Search for friends by username or select a verified user below to start chatting!
              </p>
            </div>

            {/* Search Box */}
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Who would you like to DM?"
              style={{
                width: '100%',
                background: '#0D1114',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fff',
                outline: 'none',
                fontSize: '15px',
                boxSizing: 'border-box'
              }}
              autoFocus
            />

            {/* Users List */}
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#2B3B48 transparent'
            }}>
              {loadingUsers ? (
                <div style={{ color: '#8E9297', padding: '16px', textAlign: 'center', fontSize: '14px' }}>Loading catalog...</div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ color: '#8E9297', padding: '16px', textAlign: 'center', fontSize: '14px' }}>No users match your criteria</div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => handleSelectUser(user._id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.02)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(20, 172, 123, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                  >
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.username} 
                        style={{ width: '36px', height: '36px', borderRadius: '50%' }} 
                      />
                    ) : (
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: getColorForUser(user.username),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '16px'
                      }}>
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{user.displayName || user.username}</span>
                      <span style={{ fontSize: '11px', color: '#8E9297' }}>@{user.username}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
