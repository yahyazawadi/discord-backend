import { useState, useEffect } from 'react';
import { getSocket } from '../../utils/socket';
import api from '../../utils/api';

interface ServerProfilePanelProps {
  serverId: string;
}

interface MemberType {
  user: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    systemStatus?: string;
    userStatusPreference?: string;
  };
  nickname?: string;
  resolvedStatus?: string;
}

interface ServerDetails {
  _id: string;
  name: string;
  icon?: string;
  banner?: string;
  owner: {
    _id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  admins: Array<{
    _id: string;
  }>;
  members: MemberType[];
  inviteCode?: string;
  totalMembers?: number;
  onlineCount?: number;
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

export default function ServerProfilePanel({ serverId }: ServerProfilePanelProps) {
  const [serverDetails, setServerDetails] = useState<ServerDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  
  // Nickname states
  const [editingNickname, setEditingNickname] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>('');

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = currentUser._id;

  const fetchServerDetails = async () => {
    if (!token || !serverId) return;
    try {
      const res = await api.get(`/servers/${serverId}`);
      const data = res.data;
      if (data.success) {
        setServerDetails(data.server);
        const myMember = data.server.members.find((m: MemberType) => m.user && m.user._id === currentUserId);
        setNicknameInput(myMember?.nickname || '');
      } else {
        setError(data.error || 'Failed to fetch server details');
      }
    } catch (err: any) {
      console.error('Failed to load server details:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to load server details';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchServerDetails();
  }, [serverId]);

  // Handle Socket for real-time presence updates in the member list
  useEffect(() => {
    if (!serverId) return;
    const socket = getSocket();
    socket.emit('join_server', { serverId });

    const handlePresenceUpdate = (data: { userId: string; status: string }) => {
      setServerDetails((prev) => {
        if (!prev) return prev;
        const updatedMembers = prev.members.map((m) => {
          if (m.user && m.user._id === data.userId) {
            return { ...m, resolvedStatus: data.status };
          }
          return m;
        });

        const onlineCount = updatedMembers.filter((m) =>
          ['online', 'idle', 'dnd'].includes(m.resolvedStatus || 'offline')
        ).length;

        return {
          ...prev,
          members: updatedMembers,
          onlineCount
        };
      });
    };

    socket.on('presence_update', handlePresenceUpdate);

    return () => {
      socket.emit('leave_server', { serverId });
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [serverId]);

  const copyInviteLink = () => {
    if (!serverDetails?.inviteCode) return;
    const inviteUrl = `${window.location.origin}/invite/${serverDetails.inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateNewInvite = async () => {
    if (!window.confirm('Are you sure you want to invalidate the existing invite code and generate a new one?')) return;
    try {
      const res = await api.post('/servers/invite', { serverId });
      const data = res.data;
      if (data.success) {
        setServerDetails(data.server);
        alert('New invite code generated successfully!');
      } else {
        alert(data.error || 'Failed to generate new invite code');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to generate new invite code';
      alert(errMsg);
    }
  };

  const handleUpdateNickname = async () => {
    try {
      const res = await api.put(`/servers/${serverId}/nickname`, { nickname: nicknameInput });
      const data = res.data;
      if (data.success) {
        fetchServerDetails();
        setEditingNickname(false);
      } else {
        alert(data.error || 'Failed to update nickname');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to update nickname';
      alert(errMsg);
    }
  };

  const handleLeaveServer = async () => {
    if (!window.confirm('Are you sure you want to leave this server?')) return;
    try {
      const res = await api.post(`/servers/${serverId}/leave`);
      const data = res.data;
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to leave server');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to leave server';
      alert(errMsg);
    }
  };

  // Moderator actions
  const handleKick = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to kick @${username}?`)) return;
    try {
      const res = await api.post(`/servers/${serverId}/kick/${userId}`);
      const data = res.data;
      if (data.success) {
        fetchServerDetails();
      } else {
        alert(data.error || 'Failed to kick user');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to kick user';
      alert(errMsg);
    }
  };

  const handleBan = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to BAN @${username} permanently?`)) return;
    try {
      const res = await api.post(`/servers/${serverId}/ban/${userId}`);
      const data = res.data;
      if (data.success) {
        fetchServerDetails();
      } else {
        alert(data.error || 'Failed to ban user');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to ban user';
      alert(errMsg);
    }
  };

  const handlePromote = async (userId: string) => {
    try {
      const res = await api.post(`/servers/${serverId}/admins/${userId}`);
      const data = res.data;
      if (data.success) {
        fetchServerDetails();
      } else {
        alert(data.error || 'Failed to promote user');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to promote user';
      alert(errMsg);
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      const res = await api.delete(`/servers/${serverId}/admins/${userId}`);
      const data = res.data;
      if (data.success) {
        fetchServerDetails();
      } else {
        alert(data.error || 'Failed to demote user');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to demote user';
      alert(errMsg);
    }
  };

  if (loading) {
    return (
      <aside className="profile-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#8E9297', fontSize: '14px' }}>⏳ Loading server profile...</div>
      </aside>
    );
  }

  if (error || !serverDetails) {
    return (
      <aside className="profile-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#ED4245', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
          ❌ {error || 'Server details not found'}
        </div>
      </aside>
    );
  }

  // Determine current user authorization levels
  const isOwner = serverDetails.owner._id === currentUserId;
  const isAdmin = serverDetails.admins.some((admin) => admin._id === currentUserId);
  const isModerator = isOwner || isAdmin;

  // Group members
  const ownerMember = serverDetails.members.find((m) => m.user && m.user._id === serverDetails.owner._id);
  const adminMembers = serverDetails.members.filter((m) => 
    m.user && 
    m.user._id !== serverDetails.owner._id && 
    serverDetails.admins.some((admin) => admin._id === m.user._id)
  );
  
  const regularMembers = serverDetails.members.filter((m) => 
    m.user && 
    m.user._id !== serverDetails.owner._id && 
    !serverDetails.admins.some((admin) => admin._id === m.user._id)
  );

  const bannerStyle = serverDetails.banner
    ? { backgroundImage: `url(${serverDetails.banner})` }
    : { background: `linear-gradient(135deg, ${getColorForUser(serverDetails.name)} 0%, #171E24 100%)` };

  return (
    <aside className="profile-panel" style={{ padding: '0px 11px 40px', gap: '16px' }}>
      {/* Premium Server Banner Header */}
      <div style={{
        width: '100%',
        height: '110px',
        ...bannerStyle,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
        borderRadius: '0 0 14px 14px',
        flexShrink: 0
      }}>
        {/* Server Icon overlay */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '16px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: '4px solid #131A20',
          background: getColorForUser(serverDetails.name),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#fff',
          overflow: 'hidden',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          {serverDetails.icon ? (
            <img src={serverDetails.icon} alt={serverDetails.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            serverDetails.name[0].toUpperCase()
          )}
        </div>
      </div>

      {/* Server Names & Member Stats */}
      <div style={{ alignSelf: 'stretch', padding: '36px 8px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h2 style={{
          color: '#E5F1F9',
          fontFamily: "'FONTSPRING DEMO - Salvatore Bold', 'FONTSPRING DEMO - Salvatore'",
          fontSize: '20px',
          fontWeight: 700,
          margin: 0
        }}>{serverDetails.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8E9297' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3BA55D' }} />
            <span>{serverDetails.onlineCount || 0} Online</span>
          </div>
          <span>•</span>
          <span>{serverDetails.totalMembers || 0} Members</span>
        </div>
      </div>

      {/* Cards container */}
      <div className="profile-panel-cards" style={{ gap: '14px' }}>
        {/* Invite link Card */}
        {serverDetails.inviteCode && (
          <div className="info-card">
            <span className="info-card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invite Link</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', color: '#14AC7B', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {serverDetails.inviteCode}
              </span>
              <button
                onClick={copyInviteLink}
                style={{
                  background: copied ? '#14AC7B' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {isModerator && (
              <button
                onClick={generateNewInvite}
                style={{
                  background: 'none',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#8E9297',
                  fontSize: '11px',
                  padding: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#14AC7B'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#8E9297'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              >
                🔄 Generate New Invite Code
              </button>
            )}
          </div>
        )}

        {/* My Nickname Card */}
        <div className="info-card">
          <span className="info-card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Nickname</span>
          {editingNickname ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Set nickname..."
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '4px 8px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <button onClick={handleUpdateNickname} style={{ background: '#14AC7B', border: 'none', borderRadius: '6px', color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>
                Save
              </button>
              <button onClick={() => setEditingNickname(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px', color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#fff', fontStyle: nicknameInput ? 'normal' : 'italic', opacity: nicknameInput ? 1 : 0.4 }}>
                {nicknameInput || 'No nickname set'}
              </span>
              <button
                onClick={() => setEditingNickname(true)}
                style={{ background: 'none', border: 'none', color: '#14AC7B', fontSize: '11px', cursor: 'pointer' }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Leave server option */}
        {!isOwner && (
          <button
            onClick={handleLeaveServer}
            style={{
              width: '100%',
              background: 'rgba(237, 66, 69, 0.1)',
              border: '1px solid rgba(237, 66, 69, 0.3)',
              borderRadius: '10px',
              color: '#ED4245',
              padding: '10px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
          >
            🛑 Leave Server
          </button>
        )}

        {/* Roles & Member Roster */}
        <div className="info-card" style={{ gap: '12px' }}>
          <span className="info-card-title" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Members List</span>

          {/* Owner Role Group */}
          {ownerMember && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#FAA61A', opacity: 0.8 }}>👑 Server Owner</span>
              <MemberRow key="owner" member={ownerMember} isOwner={isOwner} isModerator={isModerator} currentUserOwner={isOwner} onKick={handleKick} onBan={handleBan} onPromote={handlePromote} onDemote={handleDemote} serverOwnerId={serverDetails.owner._id} adminList={serverDetails.admins} />
            </div>
          )}

          {/* Admin Role Group */}
          {adminMembers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#14AC7B', opacity: 0.8 }}>🛡️ Administrators ({adminMembers.length})</span>
              {adminMembers.map((m) => (
                <MemberRow key={m.user._id} member={m} isOwner={isOwner} isModerator={isModerator} currentUserOwner={isOwner} onKick={handleKick} onBan={handleBan} onPromote={handlePromote} onDemote={handleDemote} serverOwnerId={serverDetails.owner._id} adminList={serverDetails.admins} />
              ))}
            </div>
          )}

          {/* Regular Members Group */}
          {regularMembers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#8E9297', opacity: 0.8 }}>👤 Members ({regularMembers.length})</span>
              {regularMembers.map((m) => (
                <MemberRow key={m.user._id} member={m} isOwner={isOwner} isModerator={isModerator} currentUserOwner={isOwner} onKick={handleKick} onBan={handleBan} onPromote={handlePromote} onDemote={handleDemote} serverOwnerId={serverDetails.owner._id} adminList={serverDetails.admins} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// Inner helper component to render user row with online indicators and option dropdown
interface MemberRowProps {
  member: MemberType;
  isOwner: boolean;
  isModerator: boolean;
  currentUserOwner: boolean;
  onKick: (id: string, name: string) => void;
  onBan: (id: string, name: string) => void;
  onPromote: (id: string) => void;
  onDemote: (id: string) => void;
  serverOwnerId: string;
  adminList: Array<{ _id: string }>;
}

const MemberRow = ({
  member,
  isModerator,
  currentUserOwner,
  onKick,
  onBan,
  onPromote,
  onDemote,
  serverOwnerId,
  adminList
}: MemberRowProps) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const { user, nickname, resolvedStatus } = member;
  const username = user.username;
  const displayName = user.displayName || user.username;
  const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${username}`;
  const avatarUrl = user.avatar || fallbackAvatar;

  const currentUserId = JSON.parse(localStorage.getItem('user') || '{}')._id;
  const isMe = user._id === currentUserId;

  // Resolve role checks for target user
  const isTargetOwner = user._id === serverOwnerId;
  const isTargetAdmin = adminList.some((admin) => admin._id === user._id);

  // Current user can moderate target if:
  // - Current user is owner AND target is not owner
  // - Current user is admin AND target is not owner AND target is not admin
  const canModerate = !isMe && !isTargetOwner && (
    currentUserOwner || (isModerator && !isTargetAdmin)
  );

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="info-card-row"
        style={{
          padding: '6px 8px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.02)',
          justifyContent: 'space-between',
          transition: 'background 0.2s',
          cursor: canModerate ? 'pointer' : 'default'
        }}
        onClick={() => { if (canModerate) setShowMenu(prev => !prev); }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {/* Avatar and status status dot */}
          <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
            <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            <span
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                border: '2px solid #171E24',
                background: resolvedStatus === 'online' ? '#3BA55D'
                  : resolvedStatus === 'idle' ? '#FAA61A'
                  : resolvedStatus === 'dnd' ? '#ED4245'
                  : '#747F8D'
              }}
            />
          </div>

          {/* Nickname / details */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nickname || displayName} {isMe && '(You)'}
            </span>
            {nickname && (
              <span style={{ fontSize: '9px', color: '#8E9297', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{username}
              </span>
            )}
          </div>
        </div>

        {/* Small chevron if modifiable */}
        {canModerate && (
          <span style={{ color: '#8E9297', fontSize: '10px' }}>▼</span>
        )}
      </div>

      {/* Floating option dialog */}
      {showMenu && canModerate && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} onClick={() => setShowMenu(false)} />
          <div style={{
            position: 'absolute',
            top: '36px',
            right: '0',
            background: '#171E24',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '130px'
          }}>
            {/* Owner specific promote demote options */}
            {currentUserOwner && (
              <>
                {isTargetAdmin ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDemote(user._id); setShowMenu(false); }}
                    style={{ background: 'none', border: 'none', color: '#FAA61A', padding: '6px 8px', fontSize: '11px', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    Demote Member
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPromote(user._id); setShowMenu(false); }}
                    style={{ background: 'none', border: 'none', color: '#14AC7B', padding: '6px 8px', fontSize: '11px', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    Promote to Admin
                  </button>
                )}
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '2px 0' }} />
              </>
            )}

            {/* Moderation kicks and bans */}
            <button
              onClick={(e) => { e.stopPropagation(); onKick(user._id, username); setShowMenu(false); }}
              style={{ background: 'none', border: 'none', color: '#FAA61A', padding: '6px 8px', fontSize: '11px', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              👞 Kick Member
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBan(user._id, username); setShowMenu(false); }}
              style={{ background: 'none', border: 'none', color: '#ED4245', padding: '6px 8px', fontSize: '11px', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              🔨 Ban Member
            </button>
          </div>
        </>
      )}
    </div>
  );
};
