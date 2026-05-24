import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../utils/socket';

import api from '../../utils/api';
import { Cross, Warning } from '../Icons';

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

const compressImageToWebP = (file: File, maxWidth = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, maxWidth);
      canvas.height = (canvas.width / img.width) * img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(img.src);
        if (!blob) {
          reject(new Error("Canvas conversion to Blob failed"));
          return;
        }
        const compressedFile = new File([blob], `img-${Date.now()}.webp`, {
          type: "image/webp"
        });
        resolve(compressedFile);
      }, "image/webp", 0.8);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(img.src);
      reject(err);
    };
  });
};

interface ServerType {
  _id: string;
  name: string;
  icon?: string;
  description?: string;
  banner?: string;
}

interface SideNavbarProps {
  activeId: string;
  setActiveId: (id: string) => void;
  refreshTrigger?: number;
}

export default function SideNavbar({ activeId, setActiveId, refreshTrigger }: SideNavbarProps) {
  const [servers, setServers] = useState<ServerType[]>([]);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [serverIcon, setServerIcon] = useState('');
  const [serverBanner, setServerBanner] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Upload progress states
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const [bannerUploadLoading, setBannerUploadLoading] = useState(false);
  const [bannerUploadProgress, setBannerUploadProgress] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch servers on load
  const fetchServers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/servers');
      const data = res.data;
      if (data.success && Array.isArray(data.servers)) {
        setServers(data.servers);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [refreshTrigger]);

  // Listen for real-time kick/ban eviction events
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user._id;
    if (!userId) return;

    const socket = getSocket();
    const handleUserRemoved = (data: { serverId: string; userId: string; action: string }) => {
      console.log('[SideNavbar] user_removed_from_server event received:', data);
      if (data.userId === userId) {
        // Remove the server from local servers list
        setServers(prev => prev.filter(s => s._id !== data.serverId));
        // If this server is currently active/selected, clear it
        if (activeId === data.serverId) {
          setActiveId('');
          localStorage.removeItem('activeServerId');
          localStorage.removeItem('activeChannelId');
        }
      }
    };

    socket.on('user_removed_from_server', handleUserRemoved);
    return () => {
      socket.off('user_removed_from_server', handleUserRemoved);
    };
  }, [activeId, setActiveId]);

  // Pre-fill suggested name
  useEffect(() => {
    if (isModalOpen) {
      setError('');
      setServerIcon('');
      setServerBanner('');
      setServerDescription('');
      setUploadProgress('');
      setBannerUploadProgress('');
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user && user.username) {
          setServerName(`${user.username}'s server`);
        } else {
          setServerName("My New Server");
        }
      } catch {
        setServerName("My New Server");
      }
    }
  }, [isModalOpen]);

  // Image compressor & Cloudflare R2 Direct Upload trigger for Server Icon
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setUploadProgress('Compressing...');
    setError('');

    try {
      // 1. Client-Side instant WebP Compression via Canvas API
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageToWebP(file);
      }

      setUploadProgress('Uploading...');

      // 2. Request pre-signed R2 upload url from backend
      const res = await api.post('/messages/upload-url', {
        fileName: uploadFile.name,
        fileType: uploadFile.type
      });

      const data = res.data;
      if (!data.signedUrl) {
        throw new Error(data.error || 'Failed to get upload URL');
      }

      // 3. Upload raw binary PUT directly to Cloudflare R2
      const uploadRes = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': uploadFile.type
        },
        body: uploadFile
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to Cloudflare R2 failed');
      }

      // 4. Update the icon URL with the permanent Cloudflare R2 public URL
      setServerIcon(data.publicUrl);
      setUploadProgress('Uploaded Successfully!');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Image upload failed';
      setError(errMsg);
      setUploadProgress('');
    } finally {
      setUploadLoading(false);
    }
  };

  // Image compressor & Cloudflare R2 Direct Upload trigger for Server Banner
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBannerUploadLoading(true);
    setBannerUploadProgress('Compressing...');
    setError('');

    try {
      // 1. Client-Side instant WebP Compression via Canvas API
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageToWebP(file);
      }

      setBannerUploadProgress('Uploading...');

      // 2. Request pre-signed R2 upload url from backend
      const res = await api.post('/messages/upload-url', {
        fileName: uploadFile.name,
        fileType: uploadFile.type
      });

      const data = res.data;
      if (!data.signedUrl) {
        throw new Error(data.error || 'Failed to get upload URL');
      }

      // 3. Upload raw binary PUT directly to Cloudflare R2
      const uploadRes = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': uploadFile.type
        },
        body: uploadFile
      });

      if (!uploadRes.ok) {
        throw new Error('Upload to Cloudflare R2 failed');
      }

      // 4. Update the banner URL with the permanent Cloudflare R2 public URL
      setServerBanner(data.publicUrl);
      setBannerUploadProgress('Uploaded Successfully!');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Banner upload failed';
      setError(errMsg);
      setBannerUploadProgress('');
    } finally {
      setBannerUploadLoading(false);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverName.trim()) {
      setError('Server name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/servers', {
        name: serverName.trim(),
        description: serverDescription.trim() || undefined,
        icon: serverIcon.trim() || undefined,
        banner: serverBanner.trim() || undefined,
        isPrivate
      });
      const data = res.data;
      if (data.success) {
        // Close modal and refresh list
        setIsModalOpen(false);
        setServerName('');
        setServerDescription('');
        setServerIcon('');
        setServerBanner('');
        setIsPrivate(false);
        
        await fetchServers();
        
        // Select the newly created server
        if (data.server && data.server._id) {
          setActiveId(data.server._id);
        }
      } else {
        setError(data.error || 'Failed to create server');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Connection failed. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="icon-bar">
        {/* App logo — active home */}
        <div 
          className={`icon-bar-item${activeId === 'home' ? ' icon-bar-item--active' : ''}`}
          onClick={() => setActiveId('home')}
        >
          <button className="icon-bar-logo" aria-label="Home">
            <svg width="48" height="48" viewBox="29 0 73 73" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="29" width="73" height="73" rx="36.5" fill="#14AC7B" />
              <path
                d="M68.0098 43.1577L62.1278 41.2142C57.325 39.4342 52.7671 35.6254 53.3599 30.6569C51.7496 30.1806 50.1275 29.6644 48.6291 29.7841C45.1715 30.0609 42.1316 32.5526 41.7781 35.8663C41.4793 38.6677 42.4913 41.046 44.7922 42.417L44.7844 42.4186C44.7844 42.4186 46.4909 43.4564 47.8603 43.8693C48.8692 44.1736 49.9688 44.5693 50.7039 44.861L51.2842 45.105C51.2991 45.1121 51.3163 45.1191 51.3304 45.1262C51.3327 45.1269 51.3359 45.1261 51.3382 45.1277L61.9495 49.5856C62.2576 49.7154 62.5837 50.4756 62.5305 50.7947C62.4758 51.1216 61.8329 51.3671 61.3418 51.3734L44.9439 51.5861C42.4913 51.6182 41.4957 54.4517 41.735 56.3959C41.965 58.2635 43.6433 60.0459 45.8894 60.0514L66.6936 60.1045C69.1313 60.1108 71.5644 59.5954 73.4312 57.7872C76.5094 54.8067 76.7691 49.943 74.2524 46.6238C72.7062 44.5849 70.3263 43.9233 68.0106 43.1584L68.0098 43.1577Z"
                fill="#E5F1F9"
              />
              <path
                d="M88.9218 35.821C88.67 32.3493 85.5745 30.1548 82.3704 29.788C80.7405 29.6019 79.1216 30.2041 77.4495 30.6647C77.1328 32.7411 78.4091 34.1841 77.0155 36.9292C76.7323 37.4876 74.8288 37.2647 74.6762 36.6445L74.3947 31.8058C74.2031 28.5171 71.0263 24.8054 67.9543 24.5355C67.302 24.4785 66.3541 24.43 65.7879 24.4511L63.1241 24.5504C59.873 24.6716 56.9269 27.9454 56.4913 31.0221C56.1206 33.6413 57.1944 36.1377 59.518 37.0175C61.9338 37.9318 64.2707 38.7021 66.7272 39.4803C70.8996 40.8012 74.8765 41.5841 77.4479 45.2341C79.3312 47.9072 79.4767 50.9386 79.2405 54.3187C81.8839 53.2872 84.1871 52.229 86.5764 51.0387C88.2461 50.2073 89.0173 48.3233 89.0251 46.397C89.0392 42.891 89.187 39.4827 88.9211 35.821H88.9218Z"
                fill="#E5F1F9"
              />
              <path
                d="M66.8203 23.6815C69.8234 23.1153 71.343 20.0456 70.7604 17.2137C70.2004 14.4929 67.5578 12.5384 64.6179 12.985C61.3715 13.4777 59.3451 16.4637 60.0091 19.4825C60.6817 22.5381 63.4166 24.3244 66.8203 23.6823V23.6815Z"
                fill="#E5F1F9"
              />
              <path
                d="M81.3161 29.0458C83.6537 29.2632 85.7137 27.6568 86.3926 25.5828C87.1481 23.2756 86.2463 20.8926 83.9791 19.7383C82.5534 19.0125 81.3044 19.0101 79.8732 19.5208C77.6372 20.3186 76.3953 22.6539 76.8168 24.9242C77.2297 27.15 79.0864 28.8385 81.3161 29.0458Z"
                fill="#E5F1F9"
              />
              <path
                d="M48.8879 29.1209C51.9005 29.2319 54.1506 26.7441 53.9785 23.7386C53.8221 21.0091 51.2138 18.9226 48.3248 19.3199C46.1937 19.6131 44.6107 21.0256 44.2322 23.3116C43.7278 26.3578 46.0435 29.0161 48.8872 29.1209H48.8879Z"
                fill="#E5F1F9"
              />
            </svg>
          </button>
        </div>

        <div className="icon-bar-divider" />

        {/* Dynamic Server List */}
        {servers.map((server) => (
          <div 
            key={server._id} 
            className={`icon-bar-item${activeId === server._id ? ' icon-bar-item--active' : ''}`}
            onClick={() => setActiveId(server._id)}
          >
            {server.icon ? (
              <img 
                src={server.icon} 
                alt={server.name} 
                className="icon-bar-server" 
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <button
                className="icon-bar-server"
                style={{
                  background: getGradientForServer(server.name),
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                aria-label={`Server ${server.name}`}
              >
                {server.name.charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        ))}

        {/* Add Server Button — Opens Modal */}
        <div 
          className={`icon-bar-item${isModalOpen ? ' icon-bar-item--active' : ''}`}
          onClick={() => setIsModalOpen(true)}
        >
          <button className="icon-bar-action-btn" aria-label="Add Server">
            <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
              <path d="M6.23388 0H4.98388V4.9825H0V6.2325H4.98388V11.2277H6.23388V6.2325H11.2264V4.9825H6.23388V0Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Discover Servers */}
        <div 
          className={`icon-bar-item${activeId === 'discover' ? ' icon-bar-item--active' : ''}`}
          onClick={() => setActiveId('discover')}
        >
          <button className="icon-bar-action-btn" aria-label="Discover Servers">
            <svg width="22" height="22" viewBox="0 0 38 38" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19 0C8.507 0 0 8.507 0 19C0 29.493 8.507 38 19 38C29.493 38 38 29.493 38 19C38 8.507 29.493 0 19 0ZM27.17 11.16L23.124 23.124L11.16 27.17L15.206 15.206L27.17 11.16Z"
                fill="currentColor"
              />
              <circle cx="19" cy="19" r="3" fill="currentColor" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Modern, Stunning Add Server Modal */}
      {isModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(9, 12, 15, 0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 0.25s ease'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            style={{
              width: '440px',
              background: '#171E24',
              borderRadius: '20px',
              padding: '30px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              color: '#fff',
              position: 'relative',
              animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              maxHeight: '85vh',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: '#2B3B48 transparent'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8E9297',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = '#8E9297';
              }}
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
            >
              <Cross size={14} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#fff' }}>Create a server</h2>
              <p style={{ fontSize: '14px', color: '#8E9297', margin: 0 }}>
                Your server is where you and your friends hang out. Make yours and start talking.
              </p>
            </div>

            {error && (
              <div style={{ 
                background: 'rgba(237, 66, 69, 0.1)', 
                border: '1px solid #ED4245', 
                borderRadius: '8px', 
                padding: '12px', 
                color: '#ED4245', 
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '10px'
              }}>
                <Warning size={16} color="#ED4245" /> {error}
              </div>
            )}

            <form onSubmit={handleCreateServer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Circular Icon Upload Block */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(255, 255, 255, 0.15)',
                    background: serverIcon ? 'none' : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#14AC7B';
                    e.currentTarget.style.backgroundColor = 'rgba(20, 172, 123, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = serverIcon ? '#14AC7B' : 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.backgroundColor = serverIcon ? 'none' : 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  {serverIcon ? (
                    <img 
                      src={serverIcon} 
                      alt="Uploaded Server Icon" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#B9BBBE', gap: '4px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload Icon</span>
                    </div>
                  )}

                  {/* Loading/Status overlay */}
                  {uploadLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: '#14AC7B',
                      textAlign: 'center',
                      padding: '4px'
                    }}>
                      {uploadProgress}
                    </div>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleIconUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                {serverIcon && !uploadLoading && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setServerIcon('');
                      setUploadProgress('');
                    }}
                    style={{
                      background: 'rgba(237, 66, 69, 0.1)',
                      border: 'none',
                      color: '#ED4245',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
                  >
                    Remove Icon
                  </button>
                )}

                {!serverIcon && uploadProgress && (
                  <span style={{ fontSize: '11px', color: '#14AC7B', fontWeight: '500' }}>{uploadProgress}</span>
                )}
              </div>

              {/* Rectangular Banner Upload Block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
                  Server Banner (Optional)
                </label>
                <div 
                  onClick={() => bannerFileInputRef.current?.click()}
                  style={{
                    height: '80px',
                    borderRadius: '10px',
                    border: '2px dashed rgba(255, 255, 255, 0.15)',
                    background: serverBanner ? `url(${serverBanner}) center/cover no-repeat` : 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s, background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#14AC7B';
                    if (!serverBanner) e.currentTarget.style.backgroundColor = 'rgba(20, 172, 123, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = serverBanner ? '#14AC7B' : 'rgba(255, 255, 255, 0.15)';
                    if (!serverBanner) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  }}
                >
                  {!serverBanner && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#B9BBBE' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>Upload Banner Image</span>
                    </div>
                  )}

                  {/* Loading/Status overlay */}
                  {bannerUploadLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%', height: '100%',
                      background: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: '#14AC7B'
                    }}>
                      {bannerUploadProgress}
                    </div>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={bannerFileInputRef}
                  onChange={handleBannerUpload}
                  accept="image/*"
                  style={{ display: 'none' }}
                />

                {serverBanner && !bannerUploadLoading && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setServerBanner('');
                      setBannerUploadProgress('');
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'rgba(237, 66, 69, 0.1)',
                      border: 'none',
                      color: '#ED4245',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
                  >
                    Remove Banner
                  </button>
                )}

                {!serverBanner && bannerUploadProgress && (
                  <span style={{ fontSize: '11px', color: '#14AC7B', fontWeight: '500' }}>{bannerUploadProgress}</span>
                )}
              </div>

              {/* Server Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
                  Server Name
                </label>
                <input 
                  type="text" 
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g. My Awesome Server"
                  style={{
                    background: '#0D1114',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '15px',
                    transition: 'border-color 0.2s',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#14AC7B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
                  required
                />
              </div>

              {/* Server Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
                  Description (Optional)
                </label>
                <textarea 
                  value={serverDescription}
                  onChange={(e) => setServerDescription(e.target.value)}
                  placeholder="Tell us what your server is about..."
                  rows={3}
                  style={{
                    background: '#0D1114',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '15px',
                    transition: 'border-color 0.2s',
                    width: '100%',
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#14AC7B'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
                />
              </div>

              {/* Privacy Setting Switch */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: '#0D1114',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Private Server</span>
                  <span style={{ fontSize: '11px', color: '#8E9297' }}>Only invited friends can view and join</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                  <input 
                    type="checkbox" 
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }} 
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isPrivate ? '#14AC7B' : '#2B3B48',
                    transition: '0.3s',
                    borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px', width: '18px',
                      left: isPrivate ? '26px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      transition: '0.3s',
                      borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '15px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadLoading || bannerUploadLoading}
                  style={{
                    flex: 2,
                    background: '#14AC7B',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    color: '#fff',
                    fontWeight: 'bold',
                    cursor: (loading || uploadLoading || bannerUploadLoading) ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    transition: 'background 0.2s, opacity 0.2s',
                    opacity: (loading || uploadLoading || bannerUploadLoading) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && !uploadLoading && !bannerUploadLoading) e.currentTarget.style.background = '#0D8760';
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && !uploadLoading && !bannerUploadLoading) e.currentTarget.style.background = '#14AC7B';
                  }}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled animation keyframes inside style tag */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .icon-bar-action-btn {
          color: #14AC7B;
          transition: background 0.2s ease, border-radius 0.2s ease, color 0.2s ease !important;
        }
        .icon-bar-action-btn:hover {
          background: #14AC7B !important;
          border-radius: 16px !important;
          color: #fff !important;
        }
      `}</style>
    </>
  );
}
