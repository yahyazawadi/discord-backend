import { useState, useEffect } from 'react';

import api from '../../utils/api';

interface InviteLandingPageProps {
  inviteCode: string;
}

interface ServerSummary {
  _id: string;
  name: string;
  icon?: string;
  banner?: string;
  description?: string;
  owner: {
    username: string;
    displayName?: string;
    avatar?: string;
  };
  totalMembers: number;
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

export default function InviteLandingPage({ inviteCode }: InviteLandingPageProps) {
  const [server, setServer] = useState<ServerSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<boolean>(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchInviteDetails = async () => {
      try {
        const res = await api.get(`/servers/invite-details/${inviteCode}`);
        const data = res.data;
        if (data.success) {
          setServer(data.server);
        } else {
          setError(data.error || 'This invite code is invalid or has expired.');
        }
      } catch (err: any) {
        console.error(err);
        const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to fetch invite details.';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };
    fetchInviteDetails();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!token) {
      // Save invite in localStorage and redirect to login
      localStorage.setItem('pendingInvite', inviteCode);
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

    setJoining(true);
    try {
      const res = await api.post(`/servers/join/${inviteCode}`);
      const data = res.data;
      if (data.success) {
        if (data.serverId) {
          localStorage.setItem('selectedServerId', data.serverId);
        }
        window.location.href = '/home';
      } else {
        alert(data.error || 'Failed to join server');
        setJoining(false);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'An error occurred while joining the server.';
      alert(errMsg);
      setJoining(false);
    }
  };

  const handleGoToLogin = () => {
    localStorage.setItem('pendingInvite', inviteCode);
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleGoToRegister = () => {
    localStorage.setItem('pendingInvite', inviteCode);
    window.history.pushState({}, '', '/register');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0B0F12',
        color: '#8E9297',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '14px', letterSpacing: '0.5px' }}>Resolving invite link...</div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0B0F12',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#ED4245', margin: '0 0 10px' }}>Invalid Invite</h2>
        <p style={{ color: '#8E9297', fontSize: '14px', maxWidth: '320px', margin: '0 0 24px', lineHeight: '1.5' }}>
          {error}
        </p>
        <button
          onClick={() => { window.location.href = '/'; }}
          style={{
            background: '#14AC7B',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#118f66'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#14AC7B'}
        >
          Return to Squad
        </button>
      </div>
    );
  }

  const bannerStyle = server.banner
    ? { backgroundImage: `url(${server.banner})` }
    : { background: `linear-gradient(135deg, ${getColorForUser(server.name)} 0%, #171E24 100%)` };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1E2830 0%, #0B0F12 100%)',
      fontFamily: 'Inter, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        width: '420px',
        background: 'rgba(23, 30, 36, 0.65)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Banner */}
        <div style={{
          width: '100%',
          height: '120px',
          ...bannerStyle,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative'
        }}>
          {/* Server Icon overlay */}
          <div style={{
            position: 'absolute',
            bottom: '-40px',
            left: 'calc(50% - 40px)',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: '6px solid #171e24',
            background: getColorForUser(server.name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#fff',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
          }}>
            {server.icon ? (
              <img src={server.icon} alt={server.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              server.name[0].toUpperCase()
            )}
          </div>
        </div>

        {/* Server Metadata and Stats */}
        <div style={{ padding: '60px 30px 30px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
          <div>
            <div style={{
              color: '#8E9297',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '6px'
            }}>You've Been Invited to Join</div>
            <h1 style={{
              color: '#fff',
              fontFamily: "'FONTSPRING DEMO - Salvatore Bold', 'FONTSPRING DEMO - Salvatore'",
              fontSize: '24px',
              fontWeight: 700,
              margin: '0 0 8px'
            }}>{server.name}</h1>
            <div style={{
              fontSize: '13px',
              color: '#8E9297',
              lineHeight: '1.5',
              fontStyle: 'italic'
            }}>
              Hosted by {server.owner.displayName || server.owner.username}
            </div>
          </div>

          {server.description && (
            <p style={{
              color: '#C7C9CB',
              fontSize: '13px',
              lineHeight: '1.6',
              margin: '0',
              background: 'rgba(0,0,0,0.15)',
              padding: '10px 14px',
              borderRadius: '8px',
              textAlign: 'left'
            }}>{server.description}</p>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#8E9297'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3BA55D' }} />
            <span>Active Server</span>
            <span style={{ margin: '0 4px' }}>•</span>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>{server.totalMembers}</span>
            <span>Members</span>
          </div>

          <div style={{ height: '8px' }} />

          {/* Action buttons */}
          {token ? (
            <button
              onClick={handleJoin}
              disabled={joining}
              style={{
                width: '100%',
                background: '#14AC7B',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                padding: '14px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(20, 172, 123, 0.2)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#118f66'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#14AC7B'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {joining ? 'Joining Server...' : 'Accept Invite & Join'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                onClick={handleJoin}
                style={{
                  width: '100%',
                  background: '#14AC7B',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(20, 172, 123, 0.2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#118f66'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#14AC7B'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                Sign In to Join
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleGoToLogin}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  Log In
                </button>
                <button
                  onClick={handleGoToRegister}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  Register
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
