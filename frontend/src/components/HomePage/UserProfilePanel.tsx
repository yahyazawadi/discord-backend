import { useState, useEffect } from 'react';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:5001/api`
  : `${window.location.origin}/api`;

interface UserProfilePanelProps {
  userId: string | null;
}

interface ProfileData {
  user: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    profileBanner?: string;
    systemStatus?: string;
    userStatusPreference?: string;
    createdAt: string;
  };
  mutualServers: Array<{
    _id: string;
    name: string;
    icon?: string;
  }>;
  mutualFriends: Array<{
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    systemStatus?: string;
    userStatusPreference?: string;
  }>;
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

export default function UserProfilePanel({ userId }: UserProfilePanelProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/auth/profile/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setProfile(data);
        } else {
          setError(data.error || 'Failed to fetch user profile');
        }
      } catch (err) {
        console.error('Failed to fetch user profile details:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <aside className="profile-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#8E9297', fontSize: '14px' }}>⏳ Loading profile...</div>
      </aside>
    );
  }

  if (error || !profile) {
    return (
      <aside className="profile-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#ED4245', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          ❌ {error || 'Profile not found'}
        </div>
      </aside>
    );
  }

  const { user, mutualServers, mutualFriends } = profile;
  const displayName = user.displayName || user.username;
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`;
  const avatarUrl = user.avatar || fallbackAvatar;

  // Format creation date
  const memberSince = (() => {
    try {
      const d = new Date(user.createdAt);
      return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'Join date unknown';
    }
  })();

  // Resolve presence status
  const systemStatus = user.userStatusPreference === 'auto' 
    ? (user.systemStatus || 'offline') 
    : (user.userStatusPreference || 'offline');

  return (
    <aside className="profile-panel">
      {/* Avatar + name */}
      <div className="profile-panel-user-block">
        <div style={{ position: 'relative' }}>
          <img
            src={avatarUrl}
            alt={displayName}
            className="profile-panel-avatar"
            style={{ border: '3px solid #171E24' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#171E24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: systemStatus === 'online' ? '#3BA55D' 
                : systemStatus === 'idle' ? '#FAA61A' 
                : systemStatus === 'dnd' ? '#ED4245' 
                : '#747F8D'
            }} />
          </div>
        </div>
        <div className="profile-panel-name-block">
          <span className="profile-panel-name">{displayName}</span>
          <span className="profile-panel-last-seen" style={{ textTransform: 'capitalize' }}>
            {systemStatus}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="profile-panel-actions">
        {/* Voice call */}
        <button className="profile-panel-action-btn" aria-label="Voice Call">
          <svg width="34" height="38" viewBox="0 0 34 38" fill="none">
            <path
              d="M18 4V0C29.03 0 38 8.972 38 20H34C34 11.178 26.822 4 18 4ZM30 20H26C26 15.59 22.412 12 18 12V8C24.618 8 30 13.382 30 20ZM18 16V20H22C22 17.792 20.21 16 18 16ZM24 26H32C33.106 26 34 26.894 34 28V36C34 37.106 33.106 38 32 38H22C9.85 38 0 28.15 0 16V6C0 4.894 0.896 4 2 4H10C11.106 4 12 4.894 12 6V14C12 15.106 11.106 16 10 16H8C8.126 23.876 14 30 22 30V28C22 26.894 22.894 26 24 26Z"
              fill="#14AC7B"
            />
          </svg>
        </button>

        {/* Video call */}
        <button className="profile-panel-action-btn" aria-label="Video Call">
          <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
            <path
              d="M42.9572 7.1977C42.3082 6.77943 41.4964 6.74514 40.8166 7.0971L35.2 10.016V4.57143C35.2 2.05029 33.2266 0 30.8 0H4.4C1.9734 0 0 2.05029 0 4.57143V27.4286C0 29.952 1.9734 32 4.4 32H30.8C33.2266 32 35.2 29.952 35.2 27.4286V21.984L40.8166 24.9006C41.1268 25.0629 41.4634 25.1429 41.8 25.1429C42.2026 25.1429 42.603 25.0263 42.9572 24.8023C43.604 24.384 44 23.6503 44 22.8571V9.14286C44 8.34971 43.604 7.616 42.9572 7.1977Z"
              fill="#14AC7B"
            />
          </svg>
        </button>
      </div>

      {/* Info cards */}
      <div className="profile-panel-cards">
        {/* Bio (only show if exists) */}
        {user.bio && (
          <div className="info-card">
            <span className="info-card-title">About Me</span>
            <span className="info-card-value" style={{ lineHeight: '1.4', fontWeight: 400 }}>{user.bio}</span>
          </div>
        )}

        {/* Member Since */}
        <div className="info-card">
          <span className="info-card-title">Member Since</span>
          <span className="info-card-value">{memberSince}</span>
        </div>

        {/* Mutual Servers */}
        <div className="info-card">
          <span className="info-card-title">Mutual Servers - {mutualServers.length}</span>
          {mutualServers.length === 0 ? (
            <span className="info-card-value" style={{ color: 'rgba(229, 241, 249, 0.4)' }}>No mutual servers</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mutualServers.map((server) => {
                const sColor = getColorForUser(server.name);
                return (
                  <div key={server._id} className="info-card-row">
                    {server.icon ? (
                      <img 
                        src={server.icon} 
                        alt={server.name} 
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <div
                        className="info-card-avatar-circle"
                        style={{ background: sColor, width: '32px', height: '32px', fontSize: '12px' }}
                      >
                        {server.name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="info-card-label">{server.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mutual Friends */}
        <div className="info-card">
          <span className="info-card-title">Mutual Friends - {mutualFriends.length}</span>
          {mutualFriends.length === 0 ? (
            <span className="info-card-value" style={{ color: 'rgba(229, 241, 249, 0.4)' }}>No mutual friends</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mutualFriends.map((friend) => {
                const fDisplayName = friend.displayName || friend.username;
                const fAvatar = friend.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${friend.username}`;
                return (
                  <div key={friend._id} className="info-card-row">
                    <img 
                      src={fAvatar} 
                      alt={fDisplayName} 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                    <span className="info-card-label">{fDisplayName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
