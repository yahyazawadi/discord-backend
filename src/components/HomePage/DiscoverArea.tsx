import React, { useState, useEffect } from 'react';

import api from '../../utils/api';
import { Warning, Check } from '../Icons';

const GRADIENTS = [
  'linear-gradient(135deg, #e056fd 0%, #686de0 100%)',
  'linear-gradient(135deg, #f9ca24 0%, #f0932b 100%)',
  'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
  'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
  'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
];

const getGradientForServer = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
};

interface DiscoverAreaProps {
  onJoinServer: (serverId: string) => void;
}

export default function DiscoverArea({ onJoinServer }: DiscoverAreaProps) {
  const [servers, setServers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchPublicServers = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const url = query 
        ? `/servers/explore?search=${encodeURIComponent(query)}`
        : `/servers/explore`;
        
      const res = await api.get(url);
      const data = res.data;
      if (data.success) {
        setServers(data.servers || []);
      } else {
        setError(data.error || 'Failed to load public servers');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Connection failed. Is the server running?';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicServers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPublicServers(searchQuery);
  };

  // Immediate fetch on clear
  useEffect(() => {
    if (searchQuery === '') {
      fetchPublicServers();
    }
  }, [searchQuery]);

  const handleJoin = async (serverId: string) => {
    try {
      const res = await api.post(`/servers/${serverId}/join-direct`);
      const data = res.data;
      if (data.success) {
        // Trigger page updates or redirect user to home server context
        onJoinServer(serverId);
      } else {
        alert(data.error || 'Failed to join server');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error joining server';
      alert(errMsg);
    }
  };

  return (
    <main style={{
      flex: 1,
      background: '#131A20',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: '#2B3B48 transparent'
    }}>
      {/* Banner Area */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1e18 0%, #14ac7b 100%)',
        padding: '60px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#fff',
        gap: '20px',
        position: 'relative',
        boxShadow: 'inset 0 -20px 40px rgba(19, 26, 32, 0.9)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M19 0C8.507 0 0 8.507 0 19C0 29.493 8.507 38 19 38C29.493 38 38 29.493 38 19C38 8.507 29.493 0 19 0ZM27.17 11.16L23.124 23.124L11.16 27.17L15.206 15.206L27.17 11.16Z"
              fill="#fff"
            />
            <circle cx="19" cy="19" r="3" fill="#fff" />
          </svg>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0, fontFamily: 'Salvatore, Inter, sans-serif' }}>
            Find your community on Squad
          </h1>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px', margin: 0, maxWidth: '600px' }}>
          From gaming, to music, to learning, there's a place for you. Discover amazing public spaces now!
        </p>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} style={{ width: '100%', maxWidth: '560px', marginTop: '10px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Explore servers..."
              style={{
                width: '100%',
                background: '#131A20',
                border: 'none',
                borderRadius: '8px',
                padding: '16px 48px 16px 16px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)'
              }}
            />
            <button
              type="submit"
              style={{
                position: 'absolute',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#14AC7B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Grid List Section */}
      <div style={{ padding: '40px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginBottom: '24px' }}>
          {searchQuery ? `Search Results for "${searchQuery}"` : 'Featured public servers'}
        </h2>

        {error && (
          <div style={{ color: '#ED4245', fontSize: '15px', fontWeight: '500', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Warning size={16} color="#ED4245" /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: '#8E9297' }}>
            <span>Searching public spaces...</span>
          </div>
        ) : servers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', color: '#8E9297', gap: '10px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span>No public servers found matching your query.</span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {servers.map((server) => {
              const isJoined = server.members?.some(
                (m: any) => (m.user?._id || m.user) === currentUser._id
              );
              
              return (
                <div
                  key={server._id}
                  style={{
                    background: '#171E24',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.25)';
                  }}
                >
                  {/* Banner/Header style placeholder */}
                  <div style={{
                    height: '100px',
                    background: server.banner ? `url(${server.banner}) center/cover no-repeat` : getGradientForServer(server.name),
                    position: 'relative'
                  }}>
                    {/* Floating circular icon */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-24px',
                      left: '16px',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: '4px solid #171E24',
                      background: getGradientForServer(server.name),
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}>
                      {server.icon ? (
                        <img src={server.icon} alt={server.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                          {server.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{
                    padding: '36px 16px 16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    gap: '12px'
                  }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                      {server.name}
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: '#B9BBBE',
                      margin: 0,
                      lineHeight: '1.4',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '54px'
                    }}>
                      {server.description || 'Welcome! Explore channels and connect with other users in this public community server.'}
                    </p>

                    {/* Member Count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8E9297' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3BA55D' }} />
                      <span>{server.members?.length || 1} member{server.members?.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Action Button */}
                    {isJoined ? (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          color: '#8E9297',
                          borderRadius: '6px',
                          padding: '10px 0',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'not-allowed'
                        }}
                      >
                        <Check size={14} color="#8E9297" /> Joined
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(server._id)}
                        style={{
                          width: '100%',
                          background: '#14AC7B',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '10px 0',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#0D8760'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#14AC7B'}
                      >
                        Join Server
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
