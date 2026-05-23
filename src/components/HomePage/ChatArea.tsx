import { useState, useRef, useEffect } from 'react';
import { getSocket, connectSocket } from '../../utils/socket';
import useVoiceChannel from '../../hooks/useVoiceChannel';

import api from '../../utils/api';

interface ChatAreaProps {
  conversationId: string | null;
  channelId: string | null;
  recipientName: string;
  recipientAvatar?: string | null;
  initialCallType?: 'audio' | 'video' | null;
  onClearInitialCallType?: () => void;
  isVoice?: boolean;
}

const VideoFeed = ({ stream, isLocal, isScreenShare, label }: { stream: MediaStream; isLocal: boolean; isScreenShare?: boolean; label: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="participant-card">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`participant-video ${isLocal ? 'local-video' : 'remote-video'} ${isScreenShare ? 'screen-share-video' : ''}`}
      />
      <div className="participant-name-badge">{label}</div>
    </div>
  );
};

const VoiceFeed = ({ participant, isLocal }: { participant: any; isLocal: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const avatar = participant.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${participant.username}`;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !participant.stream) return;
    el.srcObject = participant.stream;
    el.volume = 1.0;
    el.muted = false;
    el.play().catch((err) => {
      console.warn('[VoiceFeed] audio autoplay blocked, retrying on interaction:', err);
      // Retry play on the next user gesture
      const retry = () => { el.play().catch(() => {}); document.removeEventListener('click', retry); };
      document.addEventListener('click', retry, { once: true });
    });
  }, [participant.stream]);

  return (
    <div className="participant-card">
      {/* Hidden audio element — plays the remote participant's audio stream */}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />}
      <div className="participant-fallback-avatar">
        {participant.avatar ? (
          <img
            src={avatar}
            alt={participant.displayName || participant.username}
            className="participant-avatar-img participant-avatar-img--pulse"
          />
        ) : (
          <div className="participant-avatar-img participant-avatar-img--pulse" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#14ac7b', color: '#fff', fontSize: '28px', fontWeight: 'bold' }}>
            {participant.username ? participant.username[0].toUpperCase() : '?'}
          </div>
        )}
      </div>
      <div className="participant-name-badge">
        {participant.displayName || participant.username} {isLocal && '(You)'}
      </div>
    </div>
  );
};

const formatMessageTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  
  const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const timePart = d.toLocaleTimeString([], timeOptions);
  
  if (isToday) {
    return `Today at ${timePart}`;
  }
  if (isYesterday) {
    return `Yesterday at ${timePart}`;
  }
  
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${d.toLocaleDateString([], dateOptions)} at ${timePart}`;
};

const getMessageLocalDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return d.toLocaleDateString([], options);
};

// Check if message content is a Giphy/GIF URL
const isGifUrl = (text: string) => {
  if (!text) return false;
  const t = text.trim();
  return (t.startsWith('http://') || t.startsWith('https://')) && 
         (t.includes('giphy.com/') || t.endsWith('.gif') || t.includes('.giphy.com/media/'));
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


export default function ChatArea({ conversationId, channelId, recipientName, recipientAvatar, initialCallType, onClearInitialCallType, isVoice }: ChatAreaProps) {
  // activeCallChannelId drives the hook — it's set independently so the hook
  // gets the real channelId on the *next* render after we decide to call.
  const [activeCallChannelId, setActiveCallChannelId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const callActive = !!activeCallChannelId;

  // Keep a stable ref to leaveChannel so effects don't go stale
  const leaveChannelRef = useRef<() => void>(() => {});

  // Hook for voice/video WebRTC calling
  const {
    localStream,
    participants,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    isConnecting,
    error: callError,
    toggleMic,
    toggleCamera,
    shareScreen,
    stopScreenShare,
    leaveChannel,
  } = useVoiceChannel({
    channelId: activeCallChannelId,
    socket: getSocket(),
    enabled: callActive,
    callType: callType,
  });

  // Keep ref in sync
  leaveChannelRef.current = leaveChannel;

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!conversationId && !channelId) return;
    console.log('[ChatArea] Starting call, type:', type, 'conversationId:', conversationId, 'channelId:', channelId);
    const s = getSocket();
    if (!s.connected) {
      connectSocket();
    }
    const targetId = conversationId || channelId;
    if (conversationId) {
      s.emit('initiate_call', { conversationId, type });
    }
    setCallType(type);
    setActiveCallChannelId(targetId); // triggers hook activation on next render
  };

  const handleEndCall = () => {
    leaveChannelRef.current();
    setActiveCallChannelId(null);
    setCallType(null);
  };

  // End call when switching conversations or channels
  const prevConversationIdRef = useRef<string | null>(null);
  const prevChannelIdRef = useRef<string | null>(null);
  useEffect(() => {
    const conversationChanged = prevConversationIdRef.current !== null && prevConversationIdRef.current !== conversationId;
    const channelChanged = prevChannelIdRef.current !== null && prevChannelIdRef.current !== channelId;
    if (conversationChanged || channelChanged) {
      // conversation/channel actually changed — hang up
      leaveChannelRef.current();
      setActiveCallChannelId(null);
      setCallType(null);
    }
    prevConversationIdRef.current = conversationId;
    prevChannelIdRef.current = channelId;
  }, [conversationId, channelId]);

  // Sync with incoming call accept trigger from HomePage
  useEffect(() => {
    if (initialCallType && conversationId) {
      console.log('[ChatArea] Auto-joining call from incoming accept, type:', initialCallType);
      const s = getSocket();
      if (!s.connected) connectSocket();
      setCallType(initialCallType);
      setActiveCallChannelId(conversationId);
      onClearInitialCallType?.();
    }
  }, [initialCallType, conversationId]);

  // Auto-join voice channel when isVoice is true
  useEffect(() => {
    if (channelId && isVoice) {
      console.log('[ChatArea] Auto-joining voice channel:', channelId);
      const s = getSocket();
      if (!s.connected) connectSocket();
      setCallType('audio');
      setActiveCallChannelId(channelId);
    }
  }, [channelId, isVoice]);

  // Listen for call decline events
  useEffect(() => {
    if (!callActive) return;
    const s = getSocket();
    const handleCallDeclined = (data: { conversationId: string }) => {
      if (data.conversationId === activeCallChannelId) {
        console.log('[ChatArea] Call was declined by recipient');
        handleEndCall();
      }
    };
    s.on('call_declined', handleCallDeclined);
    return () => { s.on('call_declined', handleCallDeclined); };
  }, [callActive, activeCallChannelId]);

  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // Message Edit states
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Message Reply & Emoji states
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // File upload states
  const [selectedAttachments, setSelectedAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddEmoji = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
  };

  // GIPHY panel states
  const [giphyOpen, setGiphyOpen] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Currently logged in user context
  const [currentUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });
  const currentUserId = currentUser._id;

  // Fetch messages when conversationId or channelId changes
  useEffect(() => {
    if (!conversationId && !channelId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const url = channelId 
          ? `/messages/channel/${channelId}` 
          : `/messages/conversation/${conversationId}`;
        const res = await api.get(url);
        const data = res.data;
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId, channelId]);

  // Handle socket rooms + real-time listeners
  useEffect(() => {
    if (!conversationId && !channelId) return;

    // Ensure connection is active
    connectSocket();
    const socket = getSocket();

    // Join the target room
    if (channelId) {
      socket.emit('join_channel', { channelId });
    } else {
      socket.emit('join_conversation', { conversationId });
    }

    const handleReceiveMessage = (newMessage: any) => {
      if (
        (conversationId && newMessage.conversation === conversationId) ||
        (channelId && newMessage.channel === channelId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });
      }
    };

    const handleMessageUpdated = (updatedMessage: any) => {
      if (
        (conversationId && updatedMessage.conversation === conversationId) ||
        (channelId && updatedMessage.channel === channelId)
      ) {
        setMessages((prev) =>
          prev.map((m) => (m._id === updatedMessage._id ? updatedMessage : m))
        );
      }
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };

    const handleUserTyping = (data: any) => {
      const isTargetRoom = channelId 
        ? data.channelId === channelId 
        : data.conversationId === conversationId;
      if (isTargetRoom && data.isTyping) {
        setTypingUsers((prev) => {
          if (prev.includes(data.username)) return prev;
          return [...prev, data.username];
        });
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== data.username));
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('user_typing', handleUserTyping);

    return () => {
      if (channelId) {
        socket.emit('leave_channel', { channelId });
      } else {
        socket.emit('leave_conversation', { conversationId });
      }
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('user_typing', handleUserTyping);
    };
  }, [conversationId, channelId]);

  // GIPHY API loader
  useEffect(() => {
    if (!giphyOpen) return;

    const fetchGifs = async () => {
      setLoadingGifs(true);
      try {
        let endpoint = `/giphy/trending?limit=16`;
        if (giphySearch.trim()) {
          endpoint = `/giphy/search?q=${encodeURIComponent(giphySearch.trim())}&limit=16`;
        }
        const res = await api.get(endpoint);
        const data = res.data;
        if (data && data.data) {
          setGifs(data.data);
        }
      } catch (err) {
        console.error('Error fetching Gifs:', err);
      } finally {
        setLoadingGifs(false);
      }
    };

    const delayDebounce = setTimeout(fetchGifs, giphySearch.trim() ? 400 : 0);
    return () => clearTimeout(delayDebounce);
  }, [giphyOpen, giphySearch]);

  // Smooth scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // File select and upload handlers
  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be uploaded again
    e.target.value = '';

    setUploading(true);
    setUploadError('');
    setUploadProgressText('Compressing media...');

    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImageToWebP(file, 1200);
      }

      setUploadProgressText('Uploading to Cloudflare R2...');

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

      // Add to attachments draft
      const newAttachment = {
        url: data.publicUrl,
        fileType: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'file'),
        fileName: file.name,
        fileSize: file.size
      };

      setSelectedAttachments((prev) => [...prev, newAttachment]);
    } catch (err: any) {
      console.error('File upload failed:', err);
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      setUploadProgressText('');
    }
  };

  // Send message trigger
  const handleSendMessage = () => {
    if ((!inputValue.trim() && selectedAttachments.length === 0) || (!conversationId && !channelId)) return;

    const socket = getSocket();
    socket.emit('send_message', {
      conversationId: conversationId || null,
      channelId: channelId || null,
      content: inputValue.trim(),
      attachments: selectedAttachments,
      isAnonymous: false,
      parentMessageId: replyingToMessage?._id || null
    });

    // Notify typing stopped
    socket.emit('typing', { 
      conversationId: conversationId || null, 
      channelId: channelId || null, 
      isTyping: false 
    });
    
    setInputValue('');
    setSelectedAttachments([]);
    setReplyingToMessage(null);
  };

  // Typing indicator trigger on key stroke
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    if (!conversationId && !channelId) return;
    const socket = getSocket();

    socket.emit('typing', { 
      conversationId: conversationId || null, 
      channelId: channelId || null, 
      isTyping: true 
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { 
        conversationId: conversationId || null, 
        channelId: channelId || null, 
        isTyping: false 
      });
    }, 2000);
  };

  // Toggle ❤️ Reaction
  const handleToggleReaction = (messageId: string) => {
    const socket = getSocket();
    socket.emit('add_reaction', { messageId, emoji: '❤️', isAnonymous: false });
  };

  // Save edited message content
  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return;

    try {
      const res = await api.put(`/messages/edit/${messageId}`, { content: editingContent.trim() });
      const data = res.data;
      if (data.success) {
        setEditingMessageId(null);
        setEditingContent('');
      } else {
        alert(data.error || 'Failed to edit message');
      }
    } catch (err: any) {
      console.error('Error saving edited message:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to edit message';
      alert(errMsg);
    }
  };

  // Delete message trigger
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message permanently?')) return;

    try {
      const res = await api.delete(`/messages/${messageId}`);
      const data = res.data;
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      } else {
        alert(data.error || 'Failed to delete message');
      }
    } catch (err: any) {
      console.error('Error deleting message:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete message';
      alert(errMsg);
    }
  };

  // Send Giphy GIF link
  const handleSendGif = (gifUrl: string) => {
    if (!conversationId && !channelId) return;

    const socket = getSocket();
    socket.emit('send_message', {
      conversationId: conversationId || null,
      channelId: channelId || null,
      content: gifUrl,
      attachments: [],
      isAnonymous: false,
      parentMessageId: replyingToMessage?._id || null
    });

    setGiphyOpen(false);
    setGiphySearch('');
    setReplyingToMessage(null);
  };

  // Render welcome state if no conversation is open
  if (!conversationId && !channelId) {
    return (
      <section className="chat-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
        <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(20, 172, 123, 0.1)',
            color: '#14AC7B', fontSize: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(20,172,123,0.15)'
          }}>
            💬
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Select a Conversation or Channel</h2>
          <p style={{ fontSize: '14px', color: '#8E9297', margin: 0, lineHeight: '1.6' }}>
            Choose a friend from direct messages or select a server channel from the sidebar to start chatting!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="chat-area" style={{ position: 'relative' }}>
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-left">
          {channelId ? (
            <div style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#8E9297',
              marginRight: '8px',
              fontWeight: 'bold',
              userSelect: 'none'
            }}>
              #
            </div>
          ) : (
            <img
              src={recipientAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${recipientName}`}
              alt={recipientName}
              className="chat-header-avatar"
            />
          )}
          <span className="chat-header-name">{recipientName}</span>
        </div>

        <div className="chat-header-actions">
          {!channelId && (
            <>
              <button
                className="chat-header-action-btn"
                aria-label="Voice Call"
                onClick={() => handleStartCall('audio')}
                disabled={callActive}
                style={{ opacity: callActive ? 0.5 : 1, cursor: callActive ? 'not-allowed' : 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M6.56459 1.47368V0C10.5872 0 13.8586 3.30547 13.8586 7.36842H12.3998C12.3998 4.11821 9.78197 1.47368 6.56459 1.47368ZM10.941 7.36842H9.48219C9.48219 5.74368 8.17365 4.42105 6.56459 4.42105V2.94737C8.97818 2.94737 10.941 4.93021 10.941 7.36842ZM6.56459 5.89474V7.36842H8.02339C8.02339 6.55495 7.37058 5.89474 6.56459 5.89474ZM8.75279 9.57895H11.6704C12.0737 9.57895 12.3998 9.90832 12.3998 10.3158V13.2632C12.3998 13.6706 12.0737 14 11.6704 14H8.02339C3.59229 14 0 10.3711 0 5.89474V2.21053C0 1.80305 0.326771 1.47368 0.729399 1.47368H3.647C4.05035 1.47368 4.3764 1.80305 4.3764 2.21053V5.15789C4.3764 5.56537 4.05035 5.89474 3.647 5.89474H2.9176C2.96355 8.79642 5.1058 11.0526 8.02339 11.0526V10.3158C8.02339 9.90832 8.34943 9.57895 8.75279 9.57895Z"
                    fill="#14AC7B"
                  />
                </svg>
              </button>

              <button
                className="chat-header-action-btn"
                aria-label="Video Call"
                onClick={() => handleStartCall('video')}
                disabled={callActive}
                style={{ opacity: callActive ? 0.5 : 1, cursor: callActive ? 'not-allowed' : 'pointer' }}
              >
                <svg width="17" height="14" viewBox="0 0 17 13" fill="none">
                  <path
                    d="M15.6209 3.69914C15.385 3.54229 15.0898 3.52943 14.8426 3.66143L12.8002 4.756V2.71429C12.8002 1.76886 12.0826 1 11.2002 1H1.6002C0.717799 1 0.000199318 1.76886 0.000199318 2.71429V11.2857C0.000199318 12.232 0.717799 13 1.6002 13H11.2002C12.0826 13 12.8002 12.232 12.8002 11.2857V9.244L14.8426 10.3377C14.9554 10.3986 15.0778 10.4286 15.2002 10.4286C15.3466 10.4286 15.4922 10.3849 15.621 10.3009C15.8562 10.144 16.0002 9.86886 16.0002 9.57143V4.42857C16.0002 4.13114 15.8562 3.856 15.6209 3.69914Z"
                    fill="#14AC7B"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Calling UI Container */}
      {callActive && (
        <div className="calling-container">
          <div className="calling-header">
            <div className="calling-title">
              <span className="calling-status-indicator" />
              <span>
                {callType === 'video' ? 'Video Call' : 'Voice Call'} — {recipientName}
              </span>
            </div>
            {isConnecting && <span style={{ fontSize: '12px', color: '#FAA61A' }}>Connecting...</span>}
            {callError && <span style={{ fontSize: '12px', color: '#F85149' }}>{callError}</span>}
          </div>

          <div className="calling-participants-grid">
            {/* Local Feed */}
            {isCameraOn || isScreenSharing ? (
              localStream ? (
                <VideoFeed stream={localStream} isLocal={true} isScreenShare={isScreenSharing} label="You" />
              ) : null
            ) : (
              <VoiceFeed
                participant={{
                  username: currentUser.username,
                  displayName: currentUser.displayName || currentUser.username,
                  avatar: currentUser.avatar,
                }}
                isLocal={true}
              />
            )}

            {/* Remote Participants */}
            {participants.map((p) => {
              const hasVideo = p.stream && p.stream.getVideoTracks().length > 0 && p.stream.getVideoTracks()[0].enabled;
              return hasVideo && p.stream ? (
                <VideoFeed key={p.userId} stream={p.stream} isLocal={false} label={p.displayName || p.username} />
              ) : (
                <VoiceFeed key={p.userId} participant={p} isLocal={false} />
              );
            })}
          </div>

          <div className="calling-controls-bar">
            <button
              className={`call-control-btn ${isMicOn ? 'call-control-btn--active' : ''}`}
              onClick={toggleMic}
              title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
            >
              {isMicOn ? '🎙️' : '🔇'}
            </button>
            
            <button
              className={`call-control-btn ${isCameraOn ? 'call-control-btn--active' : ''}`}
              onClick={toggleCamera}
              title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {isCameraOn ? '📹' : '📷'}
            </button>

            <button
              className={`call-control-btn ${isScreenSharing ? 'call-control-btn--active' : ''}`}
              onClick={isScreenSharing ? stopScreenShare : shareScreen}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              🖥️
            </button>

            <button
              className="call-control-btn call-control-btn--danger"
              onClick={handleEndCall}
              title="Hang Up"
            >
              🛑
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Panel */}
      <div className="chat-messages-scroll">
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8E9297' }}>
            <span>⏳ Loading chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8E9297', gap: '8px' }}>
            <span>👋 This is the start of your message history with {recipientName}.</span>
            <span style={{ fontSize: '12px', color: '#58F6C2' }}>Say hello!</span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const currentDateLabel = getMessageLocalDate(msg.createdAt);
            const prevDateLabel = index > 0 ? getMessageLocalDate(messages[index - 1].createdAt) : null;
            const showSeparator = currentDateLabel !== prevDateLabel;

            const sender = msg.sender || { username: 'anonymous', displayName: 'Anonymous', avatar: '' };
            const fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${sender.username}`;
            const isMyMessage = sender._id === currentUserId;
            const contentIsGif = isGifUrl(msg.content);

            return (
              <div key={msg._id || index}>
                {showSeparator && (
                  <div className="chat-date-separator">
                    <div className="chat-date-line" />
                    <span className="chat-date-label">{currentDateLabel}</span>
                    <div className="chat-date-line" />
                  </div>
                )}

                {msg.parentMessage && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#72767D',
                    marginLeft: '56px',
                    marginBottom: '4px',
                    opacity: 0.85
                  }}>
                    <span style={{ color: '#14AC7B' }}>↩</span>
                    <strong style={{ color: '#B9BBBE' }}>
                      @{msg.parentMessage.sender?.displayName || msg.parentMessage.sender?.username || 'Deleted User'}
                    </strong>
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px',
                      fontStyle: 'italic'
                    }}>
                      {isGifUrl(msg.parentMessage.content) ? '[GIF]' : msg.parentMessage.content}
                    </span>
                  </div>
                )}

                <div 
                  className="chat-message"
                  style={{ position: 'relative' }}
                  onMouseEnter={(e) => {
                    const actionPanel = e.currentTarget.querySelector('.message-hover-actions') as HTMLElement;
                    if (actionPanel) actionPanel.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    const actionPanel = e.currentTarget.querySelector('.message-hover-actions') as HTMLElement;
                    if (actionPanel) actionPanel.style.opacity = '0';
                  }}
                >
                  {/* Floating Action Popover */}
                  <div 
                    className="message-hover-actions"
                    style={{
                      position: 'absolute',
                      top: '-16px',
                      right: '24px',
                      background: '#131A20',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      zIndex: 10
                    }}
                  >
                    {/* Reply Option */}
                    <button
                      onClick={() => setReplyingToMessage(msg)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', fontSize: '13px', display: 'flex', alignItems: 'center',
                        color: '#8E9297', borderRadius: '4px', transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#14AC7B';
                        e.currentTarget.style.background = 'rgba(20, 172, 123, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#8E9297';
                        e.currentTarget.style.background = 'none';
                      }}
                      title="Reply to Message"
                    >
                      ↩️
                    </button>

                    {/* Heart Reaction */}
                    <button
                      onClick={() => handleToggleReaction(msg._id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', fontSize: '13px', display: 'flex', alignItems: 'center',
                        color: '#8E9297', borderRadius: '4px', transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ED4245';
                        e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#8E9297';
                        e.currentTarget.style.background = 'none';
                      }}
                      title="Love Message"
                    >
                      ❤️
                    </button>

                    {/* Edit Option (if sender & not a GIF) */}
                    {isMyMessage && !contentIsGif && (
                      <button
                        onClick={() => {
                          setEditingMessageId(msg._id);
                          setEditingContent(msg.content);
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '4px 6px', fontSize: '13px', display: 'flex', alignItems: 'center',
                          color: '#8E9297', borderRadius: '4px', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#14AC7B';
                          e.currentTarget.style.background = 'rgba(20, 172, 123, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#8E9297';
                          e.currentTarget.style.background = 'none';
                        }}
                        title="Edit Message"
                      >
                        ✏️
                      </button>
                    )}

                    {/* Delete Option (if sender) */}
                    {isMyMessage && (
                      <button
                        onClick={() => handleDeleteMessage(msg._id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '4px 6px', fontSize: '13px', display: 'flex', alignItems: 'center',
                          color: '#8E9297', borderRadius: '4px', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ED4245';
                          e.currentTarget.style.background = 'rgba(237, 66, 69, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#8E9297';
                          e.currentTarget.style.background = 'none';
                        }}
                        title="Delete Message"
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <img
                    src={sender.avatar || fallbackAvatar}
                    alt={sender.displayName || sender.username}
                    className="chat-message-avatar"
                  />
                  <div className="chat-message-body">
                    <div className="chat-message-meta">
                      <span className="chat-message-author">{sender.displayName || sender.username}</span>
                      <span className="chat-message-timestamp">{formatMessageTime(msg.createdAt)}</span>
                    </div>

                    {/* Editing mode toggle */}
                    {editingMessageId === msg._id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        <input 
                          type="text" 
                          value={editingContent} 
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(msg._id);
                            if (e.key === 'Escape') setEditingMessageId(null);
                          }}
                          style={{
                            background: '#0D1114',
                            border: '1px solid #14AC7B',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            color: '#fff',
                            fontSize: '13px',
                            outline: 'none',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                          autoFocus
                        />
                        <span style={{ fontSize: '11px', color: '#8E9297' }}>
                          escape to <span style={{ color: '#ED4245', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setEditingMessageId(null)}>cancel</span> • enter to <span style={{ color: '#14AC7B', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleSaveEdit(msg._id)}>save</span>
                        </span>
                      </div>
                    ) : contentIsGif ? (
                      <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', maxWidth: '320px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <img 
                          src={msg.content} 
                          alt="Giphy GIF" 
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block' }} 
                        />
                      </div>
                    ) : (
                      <p className="chat-message-text" style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                        {msg.isEdited && (
                          <span style={{ fontSize: '9.5px', color: '#72767D', marginLeft: '6px', userSelect: 'none', fontStyle: 'italic' }}>(edited)</span>
                        )}
                      </p>
                    )}

                    {/* Render Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {msg.attachments.map((att: any, attIdx: number) => {
                          if (att.fileType === 'image') {
                            return (
                              <div key={attIdx} style={{ borderRadius: '12px', overflow: 'hidden', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <img 
                                  src={att.url} 
                                  alt={att.fileName || 'Attachment'} 
                                  style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', display: 'block', cursor: 'pointer' }}
                                  onClick={() => window.open(att.url, '_blank')}
                                />
                              </div>
                            );
                          } else if (att.fileType === 'video') {
                            return (
                              <div key={attIdx} style={{ borderRadius: '12px', overflow: 'hidden', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                                <video 
                                  src={att.url} 
                                  controls 
                                  style={{ width: '100%', maxHeight: '360px', display: 'block' }} 
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div key={attIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0D1114', padding: '12px', borderRadius: '8px', maxWidth: '320px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <span style={{ fontSize: '24px' }}>📄</span>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ color: '#14AC7B', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {att.fileName || 'Download File'}
                                  </a>
                                  <span style={{ fontSize: '11px', color: '#8E9297' }}>
                                    {att.fileSize ? `${(att.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}

                    {/* Heart Reactions Badge Array */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {msg.reactions.map((reaction: any, rIdx: number) => {
                          const reactedByMe = reaction.users && reaction.users.includes(currentUserId);
                          return (
                            <div 
                              key={rIdx}
                              onClick={() => handleToggleReaction(msg._id)}
                              style={{
                                background: reactedByMe ? 'rgba(20, 172, 123, 0.15)' : '#0D1114',
                                border: reactedByMe ? '1px solid #14AC7B' : '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#14AC7B';
                              }}
                              onMouseLeave={(e) => {
                                if (!reactedByMe) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                              }}
                            >
                              <span>{reaction.emoji}</span>
                              <span style={{ fontSize: '10px', color: reactedByMe ? '#14AC7B' : '#8E9297', fontWeight: 'bold' }}>
                                {(reaction.users ? reaction.users.length : 0) + (reaction.anonymousReactors ? reaction.anonymousReactors.length : 0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Giphy Search Popover */}
      {giphyOpen && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          width: '320px',
          height: '400px',
          background: '#131A20',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 999,
          overflow: 'hidden'
        }}>
          {/* Popover Header */}
          <div style={{
            padding: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#171E24'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>⚡ GIPHY search</span>
            <button 
              onClick={() => {
                setGiphyOpen(false);
                setGiphySearch('');
              }}
              style={{
                background: 'none', border: 'none', color: '#8E9297',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {/* Search bar input */}
          <div style={{ padding: '10px 12px', background: '#131A20' }}>
            <input 
              type="text"
              placeholder="Search funny, reactions, moods..."
              value={giphySearch}
              onChange={(e) => setGiphySearch(e.target.value)}
              style={{
                width: '100%',
                background: '#0D1114',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
          </div>

          {/* Grid results */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px 12px 12px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: '#131A20'
          }}>
            {loadingGifs ? (
              <div style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E9297', height: '100%' }}>
                <span>🔍 Fetching GIFs...</span>
              </div>
            ) : gifs.length === 0 ? (
              <div style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E9297', height: '100%' }}>
                <span>No GIFs found</span>
              </div>
            ) : (
              gifs.map((gif: any) => {
                const gifUrl = gif.images?.fixed_width?.url;
                if (!gifUrl) return null;
                return (
                  <img 
                    key={gif.id}
                    src={gifUrl}
                    alt={gif.title || 'GIF'}
                    onClick={() => handleSendGif(gifUrl)}
                    style={{
                      width: '100%',
                      height: '110px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.04)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Typing indicators */}
      {typingUsers.length > 0 && (
        <div style={{
          padding: '0 20px 4px 20px',
          fontSize: '11px',
          color: '#FAA61A',
          fontStyle: 'italic',
          background: 'transparent'
        }}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* CSS Animation for upload spinner */}
      <style>{`
        @keyframes upload-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Uploading progress and error notifications */}
      {(uploading || uploadError) && (
        <div style={{
          padding: '8px 16px',
          margin: '0 20px 8px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: uploadError ? 'rgba(237, 66, 69, 0.1)' : 'rgba(20, 172, 123, 0.1)',
          border: uploadError ? '1px solid #ED4245' : '1px solid #14AC7B',
          color: uploadError ? '#ED4245' : '#14AC7B',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!uploadError && <span style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid transparent',
              borderTopColor: '#14AC7B',
              borderRadius: '50%',
              animation: 'upload-spin 0.8s linear infinite'
            }} />}
            <span>{uploadError || uploadProgressText}</span>
          </div>
          {uploadError && (
            <button 
              onClick={() => setUploadError('')}
              style={{ background: 'none', border: 'none', color: '#ED4245', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Selected/uploaded attachments preview list */}
      {selectedAttachments.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          padding: '12px',
          background: '#090D0F',
          borderRadius: '8px',
          margin: '0 20px 8px 20px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {selectedAttachments.map((att, idx) => (
            <div key={idx} style={{
              position: 'relative',
              width: '100px',
              height: '100px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#0D1114',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '4px'
            }}>
              {att.fileType === 'image' ? (
                <img 
                  src={att.url} 
                  alt={att.fileName} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : att.fileType === 'video' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '24px' }}>🎬</span>
                  <span style={{ fontSize: '10px', color: '#8E9297', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '90px' }}>
                    {att.fileName}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <span style={{ fontSize: '10px', color: '#8E9297', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '90px' }}>
                    {att.fileName}
                  </span>
                </div>
              )}
              {/* Delete button */}
              <button
                onClick={() => setSelectedAttachments((prev) => prev.filter((_, i) => i !== idx))}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}


      {/* Replying banner */}
      {replyingToMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(20, 172, 123, 0.08)',
          borderLeft: '4px solid #14AC7B',
          padding: '8px 16px',
          fontSize: '13px',
          color: '#8E9297',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          margin: '0 20px -10px 20px',
          zIndex: 10,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Replying to</span>
            <strong style={{ color: '#fff' }}>
              @{replyingToMessage.sender?.displayName || replyingToMessage.sender?.username}
            </strong>
            <span style={{
              opacity: 0.6,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '250px'
            }}>
              {isGifUrl(replyingToMessage.content) ? '[GIF]' : replyingToMessage.content}
            </span>
          </div>
          <button 
            onClick={() => setReplyingToMessage(null)}
            style={{
              background: 'none', border: 'none', color: '#8E9297',
              cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="chat-input-bar">
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
        />

        <button 
          className="chat-input-add-btn" 
          aria-label="Add attachment"
          onClick={handlePlusClick}
          disabled={uploading}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 0C3.5888 0 0 3.5888 0 8.00001C0 12.4112 3.5888 16 8 16C12.4112 16 16 12.4112 16 8.00001C16 3.5888 12.4112 0 8 0ZM12 8.80001H8.8V12H7.2V8.80001H4V7.20001H7.2V4H8.8V7.20001H12V8.80001Z"
              fill="#8E9297"
            />
          </svg>
        </button>

        <input
          className="chat-input-field"
          type="text"
          placeholder={`Message ${recipientName}`}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          aria-label={`Message ${recipientName}`}
        />

        <div className="chat-input-actions">
          {/* GIF */}
          <button 
            className="chat-input-action-btn" 
            aria-label="GIF"
            onClick={() => setGiphyOpen(!giphyOpen)}
            style={{
              background: giphyOpen ? 'rgba(20, 172, 123, 0.15)' : 'none',
              borderRadius: '6px',
              padding: '4px',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
              <path
                d="M1.4702 0C0.658231 0 0 0.671573 0 1.5V13.5C0 14.3284 0.65823 15 1.4702 15H16.1722C16.9842 15 17.6424 14.3284 17.6424 13.5V1.5C17.6424 0.671573 16.9842 0 16.1722 0H1.4702ZM7.17784 7.086V10.11C6.54272 10.533 5.79291 10.767 4.9549 10.767C3.02306 10.767 1.9557 9.471 1.9557 7.554C1.9557 5.628 3.11127 4.323 4.99019 4.323C5.73999 4.323 6.36629 4.503 6.85146 4.782L6.64857 6.123C6.18987 5.826 5.65177 5.592 5.02547 5.592C3.97575 5.592 3.46412 6.384 3.46412 7.545C3.46412 8.715 3.99339 9.534 5.04311 9.534C5.37832 9.534 5.61649 9.462 5.86348 9.336V8.229H4.72555V7.086H7.17784ZM8.489 4.44H9.99743V10.65H8.489V4.44ZM15.0492 4.44V5.727H12.9057V6.996H14.5994V8.283H12.9057V10.65H11.4061V4.44H15.0492Z"
                fill={giphyOpen ? '#14AC7B' : '#8E9297'}
              />
            </svg>
          </button>

          {/* Emoji */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button 
              className="chat-input-action-btn" 
              aria-label="Emoji"
              onClick={() => setEmojiOpen(!emojiOpen)}
              style={{
                background: emojiOpen ? 'rgba(20, 172, 123, 0.15)' : 'none',
                borderRadius: '6px',
                padding: '4px',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <path
                  d="M8.5 0C3.80558 0 0 3.80558 0 8.5C0 13.1944 3.80558 17 8.5 17C13.1944 17 17 13.1944 17 8.5C17 3.80558 13.1944 0 8.5 0Z"
                  fill={emojiOpen ? '#14AC7B' : '#8E9297'}
                />
                <path
                  d="M8.5 9.91674C6.78919 9.91674 5.65418 9.71741 4.25032 9.44449C3.92967 9.38262 3.30591 9.44449 3.30591 10.3889C3.30591 12.2778 5.47568 14.6389 8.5002 14.6389C11.5243 14.6389 13.6945 12.2778 13.6945 10.3889C13.6945 9.44449 13.0708 9.38211 12.7501 9.44449C11.3463 9.71741 10.2108 9.91674 8.5 9.91674Z"
                  fill="#40444B"
                />
                <path
                  d="M4.25 10.3889C4.25 10.3889 5.66667 10.8611 8.5 10.8611C11.3333 10.8611 12.75 10.3889 12.75 10.3889C12.75 10.3889 11.8056 12.2778 8.5 12.2778C5.19444 12.2778 4.25 10.3889 4.25 10.3889Z"
                  fill={emojiOpen ? '#14AC7B' : '#8E9297'}
                />
                <circle cx="5.85703" cy="7.52779" r="1.18056" fill="#40444B" />
                <circle cx="11.1432" cy="7.52779" r="1.18056" fill="#40444B" />
              </svg>
            </button>

            {emojiOpen && (
              <div style={{
                position: 'absolute',
                bottom: '40px',
                right: '0',
                width: '280px',
                background: '#131A20',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                zIndex: 999,
                padding: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  paddingBottom: '8px'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>😀 Select Emoji</span>
                  <button 
                    onClick={() => setEmojiOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8E9297', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Smileys</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                      {['😀', '😂', '🤣', '😊', '🥰', '😍', '😘', '😜', '😎', '🤔', '🙄', '😭'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleAddEmoji(emoji)}
                          style={{
                            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
                            padding: '4px', borderRadius: '6px', transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8E9297', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Gestures & Icons</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                      {['👍', '👎', '👊', '✌️', '👏', '🙌', '🔥', '✨', '🎉', '💯', '💡', '🚀'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleAddEmoji(emoji)}
                          style={{
                            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
                            padding: '4px', borderRadius: '6px', transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8E9297', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Hearts & Symbols</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                      {['❤️', '💖', '💝', '💕', '⭐', '👀'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleAddEmoji(emoji)}
                          style={{
                            background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
                            padding: '4px', borderRadius: '6px', transition: 'background 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-divider" />

          {/* Send button */}
          <button
            className="chat-input-send-btn"
            aria-label="Send Message"
            onClick={handleSendMessage}
          >
            <svg width="18" height="18" viewBox="0 0 22 21" fill="none">
              <path
                d="M20.0239 10.9981L13.7051 11.609L12.0423 16.9269C11.9432 17.2413 12.0404 17.585 12.2906 17.8003C12.5399 18.0155 12.894 18.0609 13.1905 17.9164L21 11.2106C21.271 11.0784 21.4429 10.8036 21.4429 10.5024C21.4429 10.2012 21.271 9.92645 21 9.79425L13.1999 3.0836C12.9034 2.93914 12.5493 2.98446 12.3 3.19974C12.0498 3.41503 11.9526 3.75778 12.0517 4.07221L13.7145 9.39006L19.921 10.0019C20.1759 10.0274 20.3704 10.2417 20.3704 10.4976C20.3704 10.7535 20.1759 10.9678 19.921 10.9933L20.0239 10.9981Z"
                fill="#14AC7B"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
