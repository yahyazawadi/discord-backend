import React, { useState, useEffect, useRef } from 'react';

import api from '../../utils/api';

export type StatusType = 'online' | 'idle' | 'dnd' | 'offline' | 'streaming' | 'mobile';

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

const compressImageToWebP = (file: File, maxWidth = 600): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(img.width, maxWidth);
      canvas.height = (canvas.width / img.width) * img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
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

    img.onerror = (err) => reject(err);
  });
};

interface UserSettingsAreaProps {
  onClose: () => void;
}

export default function UserSettingsArea({ onClose }: UserSettingsAreaProps) {
  // Settings Form States
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [errorText, setErrorText] = useState('');

  // Profile status preference state
  const [currentUser, setCurrentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('token');

  // Fetch blocked users
  const fetchBlockedUsers = async () => {
    if (!token) return;
    try {
      const res = await api.get('/auth/blocked');
      const data = res.data;
      if (data.success) {
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch (err) {
      console.error('Failed to fetch blocked users:', err);
    }
  };

  useEffect(() => {
    setEditDisplayName(currentUser.displayName || currentUser.username);
    setEditBio(currentUser.bio || '');
    fetchBlockedUsers();
  }, [currentUser]);

  // Update Status Preference
  const handleStatusPreferenceChange = async (preference: 'auto' | 'online' | 'idle' | 'dnd' | 'offline') => {
    try {
      const res = await api.put('/auth/status-preference', { preference });
      const data = res.data;
      if (data.success) {
        const updatedUser = { ...currentUser, userStatusPreference: preference };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
      }
    } catch (err) {
      console.error('Failed to update status preference:', err);
    }
  };

  // Unblock a user
  const handleUnblockUser = async (userId: string) => {
    try {
      const res = await api.post(`/auth/unblock/${userId}`);
      if (res.status === 200) {
        await fetchBlockedUsers();
      }
    } catch (err) {
      console.error('Failed to unblock:', err);
    }
  };

  // Update Profile details
  const handleSaveProfile = async () => {
    setSavingSettings(true);
    setErrorText('');
    try {
      const res = await api.put('/auth/profile', {
        displayName: editDisplayName,
        bio: editBio
      });
      const data = res.data;
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } else {
        throw new Error(data.error || data.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to update profile';
      setErrorText(errMsg);
    } finally {
      setSavingSettings(false);
    }
  };

  // Upload Profile Avatar directly to R2
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingSettings(true);
    setErrorText('');
    setUploadProgressText('Compressing Avatar...');

    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageToWebP(file, 300);
      }

      setUploadProgressText('Uploading Avatar...');

      const res = await api.post('/messages/upload-url', {
        fileName: uploadFile.name,
        fileType: uploadFile.type
      });

      const data = res.data;
      if (!data.signedUrl) {
        throw new Error(data.error || 'Failed to get upload URL');
      }

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

      const saveRes = await api.put('/auth/profile', { avatar: data.publicUrl });
      const saveData = saveRes.data;
      if (saveData.success) {
        localStorage.setItem('user', JSON.stringify(saveData.user));
        setCurrentUser(saveData.user);
      } else {
        throw new Error(saveData.error || saveData.message || 'Failed to update profile avatar');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Avatar upload failed';
      setErrorText(errMsg);
    } finally {
      setSavingSettings(false);
      setUploadProgressText('');
    }
  };

  // Upload Profile Banner directly to R2
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSavingSettings(true);
    setErrorText('');
    setUploadProgressText('Compressing Banner...');

    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageToWebP(file, 1200);
      }

      setUploadProgressText('Uploading Banner...');

      const res = await api.post('/messages/upload-url', {
        fileName: uploadFile.name,
        fileType: uploadFile.type
      });

      const data = res.data;
      if (!data.signedUrl) {
        throw new Error(data.error || 'Failed to get upload URL');
      }

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

      const saveRes = await api.put('/auth/profile', { profileBanner: data.publicUrl });
      const saveData = saveRes.data;
      if (saveData.success) {
        localStorage.setItem('user', JSON.stringify(saveData.user));
        setCurrentUser(saveData.user);
      } else {
        throw new Error(saveData.error || saveData.message || 'Failed to update profile banner');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Banner upload failed';
      setErrorText(errMsg);
    } finally {
      setSavingSettings(false);
      setUploadProgressText('');
    }
  };

  // Log Out Flow
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div 
      style={{
        flex: 1,
        background: '#171E24',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        boxSizing: 'border-box',
        overflowY: 'auto',
        padding: '40px',
        position: 'relative'
      }}
    >
      {/* Close Escape floating button inside container */}
      <div style={{
        position: 'absolute',
        top: '30px',
        right: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        zIndex: 10
      }}>
        <button 
          onClick={onClose}
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            border: '2px solid #8E9297',
            background: 'transparent',
            color: '#8E9297',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#fff';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#8E9297';
            e.currentTarget.style.color = '#8E9297';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          ✕
        </button>
        <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#8E9297', textTransform: 'uppercase' }}>ESC</span>
      </div>

      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Title */}
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>User Settings</h2>
          <p style={{ fontSize: '13px', color: '#8E9297', margin: 0 }}>Configure your status, manage your secure details, and customize your visibility.</p>
        </div>

        {errorText && (
          <div style={{
            background: 'rgba(237, 66, 69, 0.1)',
            border: '1px solid rgba(237, 66, 69, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#ED4245',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box'
          }}>
            <span>⚠️ {errorText}</span>
            <button 
              onClick={() => setErrorText('')}
              style={{
                background: 'none', border: 'none', color: '#ED4245',
                cursor: 'pointer', fontSize: '16px', fontWeight: 'bold',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: Discord-style Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
            Profile Customization
          </span>
          <div style={{
            background: '#0D1114',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            {/* Banner */}
            <div style={{
              height: '130px',
              background: currentUser.profileBanner ? `url(${currentUser.profileBanner}) center/cover no-repeat` : 'linear-gradient(135deg, #14AC7B 0%, #131A20 100%)',
              position: 'relative'
            }}>
              <button 
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  top: '12px', right: '12px',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '11px', fontWeight: 'bold',
                  padding: '6px 12px', cursor: 'pointer',
                  transition: 'background 0.2s',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 999
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
              >
                Change Banner
              </button>
              <input 
                type="file" 
                ref={bannerInputRef} 
                onChange={handleBannerUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>

            {/* Profile info header with avatar */}
            <div style={{ padding: '0 24px 24px 24px', position: 'relative', marginTop: '-45px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    width: '90px', height: '90px',
                    borderRadius: '50%',
                    border: '6px solid #0D1114',
                    overflow: 'hidden',
                    background: '#131A20',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}
                >
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: getColorForUser(currentUser.username || ''),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '36px', fontWeight: 'bold'
                    }}>
                      {currentUser.username ? currentUser.username[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    opacity: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.2s',
                    color: '#fff', fontSize: '11px', fontWeight: 'bold'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  >
                    CHANGE
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={avatarInputRef} 
                  onChange={handleAvatarUpload} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{currentUser.displayName || currentUser.username}</span>
                  <span style={{ fontSize: '13px', color: '#8E9297' }}>@{currentUser.username}</span>
                </div>
              </div>

              {/* Form Fields Box */}
              <div style={{
                background: '#171E24',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Upload Loading indicator */}
                {savingSettings && (
                  <div style={{ color: '#14AC7B', fontSize: '13px', fontWeight: '500' }}>
                    ⏳ {uploadProgressText || 'Saving profile updates...'}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Display name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE' }}>Display Name</span>
                    <input 
                      type="text" 
                      value={editDisplayName} 
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      style={{
                        background: '#0D1114', border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px', padding: '10px 12px', color: '#fff', outline: 'none',
                        fontSize: '13px', width: '100%', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Read-only email */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE' }}>Email Address</span>
                    <input 
                      type="text" 
                      value={currentUser.email || ''} 
                      disabled
                      style={{
                        background: '#0D1114', border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px', padding: '10px 12px', color: '#72767D', outline: 'none',
                        fontSize: '13px', width: '100%', boxSizing: 'border-box', cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE' }}>Bio / About Me</span>
                  <textarea 
                    value={editBio} 
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Introduce yourself to other members..."
                    rows={3}
                    style={{
                      background: '#0D1114', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '6px', padding: '10px 12px', color: '#fff', outline: 'none',
                      fontSize: '13px', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button 
                  onClick={handleSaveProfile}
                  disabled={savingSettings}
                  style={{
                    alignSelf: 'flex-end',
                    background: '#14AC7B',
                    color: '#fff',
                    border: 'none', borderRadius: '6px',
                    padding: '10px 18px', fontWeight: 'bold',
                    cursor: 'pointer', fontSize: '13px',
                    transition: 'background 0.2s',
                    boxShadow: '0 2px 6px rgba(20, 172, 123, 0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0D8760'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#14AC7B'}
                >
                  Save Profile Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Online Status selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
            Online Presence State
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            {[
              { key: 'auto', label: 'Auto (System)', dot: '#3BA55D' },
              { key: 'online', label: 'Online', dot: '#3BA55D' },
              { key: 'idle', label: 'Idle', dot: '#FAA61A' },
              { key: 'dnd', label: 'Do Not Disturb', dot: '#ED4245' },
              { key: 'offline', label: 'Invisible', dot: '#747F8D' }
            ].map((pref) => {
              const isSelected = currentUser.userStatusPreference === pref.key;
              return (
                <button
                  key={pref.key}
                  onClick={() => handleStatusPreferenceChange(pref.key as any)}
                  style={{
                    background: isSelected ? 'rgba(20, 172, 123, 0.15)' : '#0D1114',
                    border: isSelected ? '1px solid #14AC7B' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: isSelected ? '#14AC7B' : '#fff',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: pref.dot }} />
                  {pref.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: Privacy & Safety / Blocked Users */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#B9BBBE', letterSpacing: '0.5px' }}>
            Privacy & Blocked Users
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {blockedUsers.length === 0 ? (
              <div style={{
                background: '#0D1114',
                padding: '24px',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#8E9297',
                border: '1px solid rgba(255,255,255,0.02)',
                fontSize: '13px'
              }}>
                You have not blocked any users yet. Your space is completely friendly!
              </div>
            ) : (
              blockedUsers.map((user) => (
                <div
                  key={user._id}
                  style={{
                    background: '#0D1114',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: getColorForUser(user.username),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '12px'
                      }}>
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{user.displayName || user.username}</span>
                      <span style={{ fontSize: '10px', color: '#8E9297' }}>@{user.username}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblockUser(user._id)}
                    style={{
                      background: 'rgba(237, 66, 69, 0.1)',
                      color: '#ED4245',
                      border: 'none', borderRadius: '6px',
                      padding: '6px 12px', fontSize: '12px', fontWeight: 'bold',
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)'}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 4: Danger Zone / Log Out */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#ED4245', letterSpacing: '0.5px' }}>
            Danger Zone
          </span>
          <div style={{
            background: 'rgba(237, 66, 69, 0.05)',
            border: '1px solid rgba(237, 66, 69, 0.15)',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ED4245' }}>Log Out of Account</span>
              <span style={{ fontSize: '12px', color: '#8E9297' }}>Sign out of your active session on this device.</span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: '#ED4245',
                color: '#fff',
                border: 'none', borderRadius: '6px',
                padding: '10px 20px', fontSize: '13px', fontWeight: 'bold',
                cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#A62427'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#ED4245'}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
