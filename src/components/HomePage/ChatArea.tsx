import { useState, useRef, useEffect, useCallback } from 'react';
import { getSocket, connectSocket } from '../../utils/socket';
import useVoiceChannel from '../../hooks/useVoiceChannel';
import { Spinner, Cross, Heart, Chat, Mic, MicOff, Camera, CameraOff, Monitor, PhoneOff, Wave, Edit, Trash, File as FileIcon, Film, Smiley, Reply } from '../Icons';

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

// Memory cache to hold messages for rooms when out of view
const chatMessagesCache: Record<string, any[]> = {};

const VideoFeed = ({ stream, isLocal, isScreenShare, label, isDeafened }: { stream: MediaStream; isLocal: boolean; isScreenShare?: boolean; label: string; isDeafened?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`participant-card ${isFullscreen ? 'participant-card--fullscreen' : ''}`}
      style={{ position: 'relative' }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isDeafened}
        className={`participant-video ${isLocal ? 'local-video' : 'remote-video'} ${isScreenShare ? 'screen-share-video' : ''}`}
      />
      <div className="participant-name-badge">{label}</div>
      <button
        onClick={toggleFullscreen}
        className="video-fullscreen-btn"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          borderRadius: '6px',
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          zIndex: 10,
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'; e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isFullscreen ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M10 21v-6H4M4 20l6-6M20 4l-6 6M14 10V4"/>
          </svg>
        )}
      </button>
    </div>
  );
};

const VoiceFeed = ({ participant, isLocal, isDeafened }: { participant: any; isLocal: boolean; isDeafened?: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const avatar = participant.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${participant.username}`;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !participant.stream) return;
    el.srcObject = participant.stream;
    el.volume = 1.0;
    el.muted = !!isDeafened;
    el.play().catch((err) => {
      console.warn('[VoiceFeed] audio autoplay blocked, retrying on interaction:', err);
      // Retry play on the next user gesture
      const retry = () => { el.play().catch(() => {}); document.removeEventListener('click', retry); };
      document.addEventListener('click', retry, { once: true });
    });
  }, [participant.stream, isDeafened]);

  return (
    <div className="participant-card">
      {/* Hidden audio element — plays the remote participant's audio stream */}
      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none'
          }}
        />
      )}
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


export default function ChatArea({ conversationId, channelId, recipientName, recipientAvatar, initialCallType, onClearInitialCallType, isVoice }: ChatAreaProps) {
  // activeCallChannelId drives the hook — it's set independently so the hook
  // gets the real channelId on the *next* render after we decide to call.
  const [activeCallChannelId, setActiveCallChannelId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const callActive = !!activeCallChannelId;

  // Keep a stable ref to leaveChannel so effects don't go stale
  const leaveChannelRef = useRef<() => void>(() => {});

  const chatPaneRef = useRef<HTMLDivElement>(null);
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);

  // Resizable voice/chat split (percentage height for call pane, out of 100)
  const [callPaneHeightPct, setCallPaneHeightPct] = useState(55);
  const isDraggingRef = useRef(false);
  const voiceLayoutRef = useRef<HTMLElement>(null);

  const handleResizeDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !voiceLayoutRef.current) return;
      const containerRect = voiceLayoutRef.current.getBoundingClientRect();
      const clientY = ev instanceof MouseEvent ? ev.clientY : ev.touches[0].clientY;
      const newPct = Math.min(80, Math.max(20, ((clientY - containerRect.top) / containerRect.height) * 100));
      setCallPaneHeightPct(newPct);
    };

    const onUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove as EventListener);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as EventListener);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove as EventListener);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as EventListener, { passive: false });
    document.addEventListener('touchend', onUp);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsChatFullscreen(document.fullscreenElement === chatPaneRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleChatFullscreen = () => {
    if (!chatPaneRef.current) return;
    if (!document.fullscreenElement) {
      chatPaneRef.current.requestFullscreen().catch((err) => {
        console.error('Error enabling chat fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

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
    isDeafened,
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

    const roomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';

    // Load from memory cache if available to display instantly
    if (chatMessagesCache[roomKey]) {
      setMessages(chatMessagesCache[roomKey]);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }

    const fetchMessages = async () => {
      try {
        const url = channelId 
          ? `/messages/channel/${channelId}` 
          : `/messages/conversation/${conversationId}`;
        const res = await api.get(url);
        const data = res.data;
        if (data.success) {
          const fetchedMessages = data.messages || [];
          chatMessagesCache[roomKey] = fetchedMessages;

          const currentRoomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
          if (currentRoomKey === roomKey) {
            setMessages(fetchedMessages);
          }
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        const currentRoomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
        if (currentRoomKey === roomKey) {
          setLoading(false);
        }
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
      const roomKey = newMessage.channel 
        ? `channel-${newMessage.channel}` 
        : newMessage.conversation 
          ? `dm-${newMessage.conversation}` 
          : '';

      if (roomKey) {
        const cached = chatMessagesCache[roomKey] || [];
        if (!cached.some((m) => m._id === newMessage._id)) {
          if (newMessage.sender?._id === currentUserId) {
            const idx = cached.findIndex((m) => m.isOptimistic && m.content === newMessage.content);
            if (idx !== -1) {
              cached[idx] = newMessage;
            } else {
              cached.push(newMessage);
            }
          } else {
            cached.push(newMessage);
          }
          chatMessagesCache[roomKey] = cached;
        }
      }

      if (
        (conversationId && newMessage.conversation === conversationId) ||
        (channelId && newMessage.channel === channelId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMessage._id)) return prev;
          if (newMessage.sender?._id === currentUserId) {
            const index = prev.findIndex((m) => m.isOptimistic && m.content === newMessage.content);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = newMessage;
              return updated;
            }
          }
          return [...prev, newMessage];
        });
      }
    };

    const handleMessageUpdated = (updatedMessage: any) => {
      const roomKey = updatedMessage.channel 
        ? `channel-${updatedMessage.channel}` 
        : updatedMessage.conversation 
          ? `dm-${updatedMessage.conversation}` 
          : '';

      if (roomKey && chatMessagesCache[roomKey]) {
        chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
          m._id === updatedMessage._id ? updatedMessage : m
        );
      }

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
      Object.keys(chatMessagesCache).forEach((roomKey) => {
        chatMessagesCache[roomKey] = chatMessagesCache[roomKey].filter((m) => m._id !== messageId);
      });

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

    const contentStr = inputValue.trim();
    const attachmentsArr = selectedAttachments;
    const tempId = 'temp-' + Date.now();

    const optimisticMsg = {
      _id: tempId,
      content: contentStr,
      attachments: attachmentsArr,
      sender: currentUser,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      parentMessage: replyingToMessage ? {
        _id: replyingToMessage._id,
        content: replyingToMessage.content,
        sender: replyingToMessage.sender
      } : null
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    const roomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
    if (roomKey) {
      chatMessagesCache[roomKey] = [...(chatMessagesCache[roomKey] || []), optimisticMsg];
    }

    const socket = getSocket();
    socket.emit('send_message', {
      conversationId: conversationId || null,
      channelId: channelId || null,
      content: contentStr,
      attachments: attachmentsArr,
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

    let originalContent = '';
    setMessages((prev) => {
      return prev.map((m) => {
        if (m._id === messageId) {
          originalContent = m.content;
          return { ...m, content: editingContent.trim(), isOptimistic: true };
        }
        return m;
      });
    });

    const roomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
    if (roomKey && chatMessagesCache[roomKey]) {
      chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
        m._id === messageId ? { ...m, content: editingContent.trim(), isOptimistic: true } : m
      );
    }

    try {
      const res = await api.put(`/messages/edit/${messageId}`, { content: editingContent.trim() });
      const data = res.data;
      if (data.success) {
        setEditingMessageId(null);
        setEditingContent('');
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, isOptimistic: false } : m))
        );
        if (roomKey && chatMessagesCache[roomKey]) {
          chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
            m._id === messageId ? { ...m, isOptimistic: false } : m
          );
        }
      } else {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, content: originalContent, isOptimistic: false } : m))
        );
        if (roomKey && chatMessagesCache[roomKey]) {
          chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
            m._id === messageId ? { ...m, content: originalContent, isOptimistic: false } : m
          );
        }
        alert(data.error || 'Failed to edit message');
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, content: originalContent, isOptimistic: false } : m))
      );
      if (roomKey && chatMessagesCache[roomKey]) {
        chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
          m._id === messageId ? { ...m, content: originalContent, isOptimistic: false } : m
        );
      }
      console.error('Error saving edited message:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to edit message';
      alert(errMsg);
    }
  };

  // Delete message trigger
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message permanently?')) return;

    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId ? { ...m, isOptimistic: true } : m
      )
    );

    const roomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
    if (roomKey && chatMessagesCache[roomKey]) {
      chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
        m._id === messageId ? { ...m, isOptimistic: true } : m
      );
    }

    try {
      const res = await api.delete(`/messages/${messageId}`);
      const data = res.data;
      if (data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
        if (roomKey && chatMessagesCache[roomKey]) {
          chatMessagesCache[roomKey] = chatMessagesCache[roomKey].filter((m) => m._id !== messageId);
        }
      } else {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, isOptimistic: false } : m))
        );
        if (roomKey && chatMessagesCache[roomKey]) {
          chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
            m._id === messageId ? { ...m, isOptimistic: false } : m
          );
        }
        alert(data.error || 'Failed to delete message');
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, isOptimistic: false } : m))
      );
      if (roomKey && chatMessagesCache[roomKey]) {
        chatMessagesCache[roomKey] = chatMessagesCache[roomKey].map((m) =>
          m._id === messageId ? { ...m, isOptimistic: false } : m
        );
      }
      console.error('Error deleting message:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to delete message';
      alert(errMsg);
    }
  };

  // Send Giphy GIF link
  const handleSendGif = (gifUrl: string) => {
    if (!conversationId && !channelId) return;

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      _id: tempId,
      content: gifUrl,
      attachments: [],
      sender: currentUser,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      parentMessage: replyingToMessage ? {
        _id: replyingToMessage._id,
        content: replyingToMessage.content,
        sender: replyingToMessage.sender
      } : null
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    const roomKey = channelId ? `channel-${channelId}` : conversationId ? `dm-${conversationId}` : '';
    if (roomKey) {
      chatMessagesCache[roomKey] = [...(chatMessagesCache[roomKey] || []), optimisticMsg];
    }

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

  const renderChatContent = () => {
    return (
      <>
        {/* Messages Scroll Panel */}
        <div className="chat-messages-scroll">
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8E9297', gap: '8px' }}>
              <Spinner size={16} color="#14AC7B" />
              <span>Loading chat history...</span>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8E9297', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wave size={20} color="#14AC7B" />
                <span>This is the start of your message history with {recipientName}.</span>
              </div>
              <span style={{ fontSize: '12px', color: '#58F6C2' }}>Say hello!</span>
            </div>
          ) : (
            messages.map((msg, index) => {
              const currentDateLabel = getMessageLocalDate(msg.createdAt);
              const prevDateLabel = index > 0 ? getMessageLocalDate(messages[index - 1].createdAt) : null;
              const showSeparator = currentDateLabel !== prevDateLabel;

              const sender = msg.sender || { username: 'anonymous', displayName: 'Anonymous', avatar: '' };
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

                  <div 
                    className={`chat-message-row ${editingMessageId === msg._id ? 'chat-message-row--editing' : ''} ${msg.isOptimistic ? 'chat-message-row--faded' : ''}`}
                    style={{
                      display: 'flex',
                      padding: '8px 20px',
                      gap: '16px',
                      position: 'relative',
                      alignItems: 'flex-start',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      const actions = e.currentTarget.querySelector('.chat-message-actions') as HTMLElement;
                      if (actions && !editingMessageId && !msg.isOptimistic) actions.style.display = 'flex';
                    }}
                    onMouseLeave={(e) => {
                      const actions = e.currentTarget.querySelector('.chat-message-actions') as HTMLElement;
                      if (actions) actions.style.display = 'none';
                    }}
                  >
                    {/* User Avatar */}
                    {sender.avatar ? (
                      <img
                        src={sender.avatar}
                        alt={sender.username}
                        className="chat-message-avatar"
                      />
                    ) : (
                      <div className="chat-message-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#14ac7b', color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                        {sender.username ? sender.username[0].toUpperCase() : '?'}
                      </div>
                    )}

                    {/* Message Body */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                          {sender.displayName || sender.username}
                        </span>
                        <span style={{ fontSize: '10px', color: '#72767D' }}>
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>

                      {/* Reply preview */}
                      {msg.parentMessage && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: '2px solid #14AC7B',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#8E9297',
                          marginTop: '2px',
                          marginBottom: '4px',
                          width: 'fit-content',
                          maxWidth: '80%'
                        }}>
                          <Reply size={12} color="#14AC7B" />
                          <span style={{ fontWeight: '600', color: '#fff' }}>
                            @{msg.parentMessage.sender?.displayName || msg.parentMessage.sender?.username}
                          </span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isGifUrl(msg.parentMessage.content) ? '[GIF]' : msg.parentMessage.content}
                          </span>
                        </div>
                      )}

                      {/* Editing / Content */}
                      {editingMessageId === msg._id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', width: '100%' }}>
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
                              fontSize: '14px',
                              outline: 'none',
                              width: '100%'
                            }}
                            autoFocus
                          />
                          <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#8E9297' }}>
                            <span>escape to <button onClick={() => setEditingMessageId(null)} style={{ background: 'none', border: 'none', color: '#14AC7B', padding: 0, cursor: 'pointer' }}>cancel</button></span>
                            <span>•</span>
                            <span>enter to <button onClick={() => handleSaveEdit(msg._id)} style={{ background: 'none', border: 'none', color: '#14AC7B', padding: 0, cursor: 'pointer' }}>save</button></span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: '#DCDDDE', fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          {contentIsGif ? (
                            <img 
                              src={msg.content} 
                              alt="GIF" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '240px', 
                                borderRadius: '8px', 
                                marginTop: '4px',
                                objectFit: 'contain'
                              }} 
                            />
                          ) : (
                            msg.content
                          )}

                          {/* Render files/attachments if any */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                              {msg.attachments.map((att: any, attIdx: number) => {
                                const isImg = att.fileType === 'image';
                                const isVid = att.fileType === 'video';
                                
                                return (
                                  <div key={attIdx} style={{ maxWidth: '100%' }}>
                                    {isImg ? (
                                      <img 
                                        src={att.url} 
                                        alt={att.fileName} 
                                        style={{ 
                                          maxWidth: '100%', 
                                          maxHeight: '300px', 
                                          borderRadius: '8px', 
                                          border: '1px solid rgba(255,255,255,0.05)',
                                          cursor: 'pointer'
                                        }} 
                                        onClick={() => window.open(att.url, '_blank')}
                                      />
                                    ) : isVid ? (
                                      <video 
                                        src={att.url} 
                                        controls 
                                        playsInline 
                                        style={{ 
                                          maxWidth: '100%', 
                                          maxHeight: '300px', 
                                          borderRadius: '8px',
                                          border: '1px solid rgba(255,255,255,0.05)'
                                        }} 
                                      />
                                    ) : (
                                      <a 
                                        href={att.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '10px',
                                          padding: '12px',
                                          background: '#0D1114',
                                          borderRadius: '8px',
                                          border: '1px solid rgba(255,255,255,0.08)',
                                          color: '#14AC7B',
                                          textDecoration: 'none',
                                          fontSize: '13px',
                                          width: 'fit-content',
                                          transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#12171B'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#0D1114'}
                                      >
                                        <FileIcon size={24} color="#14AC7B" />
                                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{att.fileName}</span>
                                          <span style={{ color: '#8E9297', fontSize: '11px' }}>{(att.fileSize / 1024).toFixed(1)} KB</span>
                                        </div>
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Display edited timestamp if edited */}
                      {msg.isEdited && !editingMessageId && (
                        <span style={{ fontSize: '10px', color: '#72767D', fontStyle: 'italic', marginLeft: '4px' }}>
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Quick Reactions Bar & Actions */}
                    {!msg.isOptimistic && (
                      <>
                        {/* Hover action buttons (Edit, Delete, Reply) */}
                        <div 
                          className="chat-message-actions" 
                          style={{
                            display: 'none',
                            position: 'absolute',
                            top: '-16px',
                            right: '20px',
                            background: '#0D1114',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '4px',
                            padding: '2px',
                            zIndex: 5,
                            gap: '4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                          }}
                        >
                          {/* Reply Button */}
                          <button
                            onClick={() => setReplyingToMessage(msg)}
                            style={{
                              background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer',
                              padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            title="Reply to Message"
                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8E9297'}
                          >
                            <Reply size={16} color="currentColor" />
                          </button>

                          {isMyMessage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg._id);
                                  setEditingContent(msg.content);
                                }}
                                style={{
                                  background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer',
                                  padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Edit Message"
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = '#8E9297'}
                              >
                                <Edit size={16} color="currentColor" />
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg._id)}
                                style={{
                                  background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer',
                                  padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Delete Message"
                                onMouseEnter={e => e.currentTarget.style.color = '#F85149'}
                                onMouseLeave={e => e.currentTarget.style.color = '#8E9297'}
                              >
                                <Trash size={16} color="currentColor" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Reaction details (if any exist) */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div style={{
                            display: 'flex',
                            gap: '6px',
                            flexWrap: 'wrap',
                            marginTop: '6px',
                            paddingLeft: '56px'
                          }}>
                            {(() => {
                              // Group reactions by emoji
                              const counts: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
                              msg.reactions.forEach((r: any) => {
                                const reactorId = r.user?._id || r.user;
                                const isMe = reactorId === currentUserId;
                                if (!counts[r.emoji]) {
                                  counts[r.emoji] = { count: 0, users: [], hasReacted: false };
                                }
                                counts[r.emoji].count += 1;
                                counts[r.emoji].users.push(r.user?.username || 'someone');
                                if (isMe) counts[r.emoji].hasReacted = true;
                              });

                              return Object.entries(counts).map(([emoji, data]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg._id)}
                                  title={`Reacted by: ${data.users.join(', ')}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: data.hasReacted ? 'rgba(20, 172, 123, 0.15)' : '#0D1114',
                                    border: data.hasReacted ? '1px solid #14AC7B' : '1px solid rgba(255,255,255,0.05)',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: data.hasReacted ? '#fff' : '#8E9297',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#14AC7B';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!data.hasReacted) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                  }}
                                >
                                  {emoji === '❤️' ? (
                                    <Heart size={14} color="#FF4B4B" fill="#FF4B4B" />
                                  ) : (
                                    <span>{emoji}</span>
                                  )}
                                  <span>{data.count}</span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Giphy search container */}
        {giphyOpen && (
          <div style={{
            position: 'absolute',
            bottom: '72px',
            left: '20px',
            right: '20px',
            background: '#0D1114',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#14AC7B' }}>Search Giphy</span>
              <button 
                onClick={() => setGiphyOpen(false)}
                style={{ background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Cross size={16} color="#8E9297" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Search funny gifs..."
              value={giphySearch}
              onChange={(e) => setGiphySearch(e.target.value)}
              style={{
                background: '#070A0C',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                width: '100%',
              }}
              autoFocus
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              maxHeight: '160px',
              overflowY: 'auto',
              marginTop: '4px'
            }}>
              {loadingGifs ? (
                <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center', padding: '20px', color: '#8E9297' }}>
                  <Spinner size={20} color="#14AC7B" />
                </div>
              ) : gifs.length === 0 ? (
                <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '20px', color: '#8E9297', fontSize: '12px' }}>
                  No GIFs found. Try typing a query.
                </div>
              ) : (
                gifs.map((gif: any) => {
                  const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
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
                style={{ background: 'none', border: 'none', color: '#ED4245', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Cross size={14} color="#ED4245" />
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
                    <Film size={24} color="#14AC7B" />
                    <span style={{ fontSize: '10px', color: '#8E9297', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '90px' }}>
                      {att.fileName}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <FileIcon size={24} color="#14AC7B" />
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
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <Cross size={10} color="#fff" />
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
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Cross size={14} color="#8E9297" />
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
              <Film size={20} color={giphyOpen ? '#14AC7B' : '#8E9297'} />
            </button>

            {/* Emoji Trigger */}
            <button 
              className="chat-input-action-btn" 
              aria-label="Add Emoji"
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
              <Smiley size={20} color={emojiOpen ? '#14AC7B' : '#8E9297'} />
            </button>

            {/* Custom Emoji Picker Popover */}
            {emojiOpen && (
              <div style={{
                position: 'absolute',
                bottom: '72px',
                right: '20px',
                background: '#0D1114',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px',
                zIndex: 100,
                width: '240px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#14AC7B' }}>Choose an Emoji</span>
                  <button 
                    onClick={() => setEmojiOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#8E9297', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Cross size={14} color="#8E9297" />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#8E9297', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase' }}>Expressive Faces</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                      {['😆', '😂', '🔥', '👍', '🎉', '👏'].map(emoji => (
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
      </>
    );
  };

  // Render welcome state if no conversation is open
  if (!conversationId && !channelId) {
    return (
      <section className="chat-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
        <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(20, 172, 123, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(20,172,123,0.15)'
          }}>
            <Chat size={32} color="#14AC7B" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', margin: 0 }}>Select a Conversation or Channel</h2>
          <p style={{ fontSize: '14px', color: '#8E9297', margin: 0, lineHeight: '1.6' }}>
            Choose a friend from direct messages or select a server channel from the sidebar to start chatting!
          </p>
        </div>
      </section>
    );
  }

  if (isVoice) {
    return (
      <section ref={voiceLayoutRef} className="chat-area voice-layout-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: '#0b0e11' }}>
        {/* Top Call/Join Pane */}
        <div className="voice-call-pane" style={{ height: `${callPaneHeightPct}%`, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#0b0e11', position: 'relative', flexShrink: 0 }}>
          {callActive ? (
            <div className="voice-call-active-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
              <div className="calling-header" style={{ flexShrink: 0 }}>
                <div className="calling-title">
                  <span className="calling-status-indicator" />
                  <span>
                    {callType === 'video' ? 'Video Call' : 'Voice Call'} — {recipientName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isConnecting && <span style={{ fontSize: '12px', color: '#FAA61A' }}>Connecting...</span>}
                  {callError && <span style={{ fontSize: '12px', color: '#F85149' }}>{callError}</span>}
                </div>
              </div>

              {/* Call Grid */}
              <div className="calling-participants-grid voice-participants-grid-custom" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {/* Local Feed */}
                {isCameraOn || isScreenSharing ? (
                  localStream ? (
                    <VideoFeed stream={localStream} isLocal={true} isScreenShare={isScreenSharing} label="You" isDeafened={isDeafened} />
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
                    <VideoFeed key={p.userId} stream={p.stream} isLocal={false} label={p.displayName || p.username} isDeafened={isDeafened} />
                  ) : (
                    <VoiceFeed key={p.userId} participant={p} isLocal={false} isDeafened={isDeafened} />
                  );
                })}
              </div>

              {/* Controls bar */}
              <div className="calling-controls-bar" style={{ flexShrink: 0, padding: '16px', background: '#12181d', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  className={`call-control-btn ${isMicOn ? 'call-control-btn--active' : ''}`}
                  onClick={toggleMic}
                  title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                
                <button
                  className={`call-control-btn ${isCameraOn ? 'call-control-btn--active' : ''}`}
                  onClick={toggleCamera}
                  title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
                </button>
     
                <button
                  className={`call-control-btn ${isScreenSharing ? 'call-control-btn--active' : ''}`}
                  onClick={isScreenSharing ? stopScreenShare : shareScreen}
                  title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                  <Monitor size={20} />
                </button>
     
                <button
                  className="call-control-btn call-control-btn--danger"
                  onClick={handleEndCall}
                  title="Leave Call"
                >
                  <PhoneOff size={20} color="#fff" />
                </button>
              </div>
            </div>
          ) : (
            <div className="voice-call-inactive-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', textAlign: 'center', gap: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(20, 172, 123, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(20, 172, 123, 0.2)'
              }}>
                <Mic size={32} color="#14AC7B" />
              </div>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: '600' }}>Voice Channel disconnected</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#8E9297', maxWidth: '320px', lineHeight: '1.5' }}>
                You have left the voice call, but you can still view and send text messages in this channel.
              </p>
              <button
                onClick={() => handleStartCall('audio')}
                style={{
                  background: '#14AC7B',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(20, 172, 123, 0.25)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#119369'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#14AC7B'}
              >
                Join Voice Channel
              </button>
            </div>
          )}
        </div>

        {/* Resize Notch / Drag Handle */}
        <div
          className="voice-resize-handle"
          onMouseDown={handleResizeDragStart}
          onTouchStart={handleResizeDragStart}
          title="Drag to resize voice/chat split"
        >
          {/* Three-bar grip */}
          <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: '3px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="voice-resize-grip-bar" style={{
                width: '40px',
                height: '2px',
                borderRadius: '2px',
                background: 'rgba(255,255,255,0.18)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
        </div>

        {/* Bottom Chat Pane */}
        <div 
          ref={chatPaneRef} 
          className={`voice-chat-pane ${isChatFullscreen ? 'voice-chat-pane--fullscreen' : ''}`}
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            background: '#131A20',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative'
          }}
        >
          {/* Chat Pane Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#171E24',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            height: '52px',
            flexShrink: 0
          }}>
            <span style={{ color: '#14AC7B', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              # {recipientName} Chat
            </span>
            <button
              onClick={toggleChatFullscreen}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#8E9297',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                borderRadius: '4px',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              title={isChatFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chat'}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#8E9297'; e.currentTarget.style.background = 'none'; }}
            >
              {isChatFullscreen ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M10 21v-6H4M4 20l6-6M20 4l-6 6M14 10V4"/>
                </svg>
              )}
            </button>
          </div>
          {renderChatContent()}
        </div>
      </section>
    );
  }

  // Otherwise, render the original chat-area layout
  return (
    <section
      ref={(el) => { (voiceLayoutRef as any).current = el; }}
      className="chat-area"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Header — always pinned at top */}
      <header className="chat-header" style={{ flexShrink: 0 }}>
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

      {/* When a call is active: resizable call pane + drag handle + chat */}
      {callActive ? (
        <>
          {/* Call pane — resizable height */}
          <div style={{ height: `${callPaneHeightPct}%`, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="calling-container" style={{ margin: 0, borderRadius: 0, border: 'none', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

              <div className="calling-participants-grid" style={{ flex: 1, maxHeight: 'none', overflowY: 'auto' }}>
                {/* Local Feed */}
                {isCameraOn || isScreenSharing ? (
                  localStream ? (
                    <VideoFeed stream={localStream} isLocal={true} isScreenShare={isScreenSharing} label="You" isDeafened={isDeafened} />
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
                    <VideoFeed key={p.userId} stream={p.stream} isLocal={false} label={p.displayName || p.username} isDeafened={isDeafened} />
                  ) : (
                    <VoiceFeed key={p.userId} participant={p} isLocal={false} isDeafened={isDeafened} />
                  );
                })}
              </div>

              <div className="calling-controls-bar">
                <button
                  className={`call-control-btn ${isMicOn ? 'call-control-btn--active' : ''}`}
                  onClick={toggleMic}
                  title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                
                <button
                  className={`call-control-btn ${isCameraOn ? 'call-control-btn--active' : ''}`}
                  onClick={toggleCamera}
                  title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
                </button>
 
                <button
                  className={`call-control-btn ${isScreenSharing ? 'call-control-btn--active' : ''}`}
                  onClick={isScreenSharing ? stopScreenShare : shareScreen}
                  title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                  <Monitor size={20} />
                </button>
 
                <button
                  className="call-control-btn call-control-btn--danger"
                  onClick={handleEndCall}
                  title="Hang Up"
                >
                  <PhoneOff size={20} color="#fff" />
                </button>
              </div>
            </div>
          </div>

          {/* Resize Notch / Drag Handle */}
          <div
            className="voice-resize-handle"
            onMouseDown={handleResizeDragStart}
            onTouchStart={handleResizeDragStart}
            title="Drag to resize call/chat split"
          >
            <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: '3px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="voice-resize-grip-bar" style={{
                  width: '40px',
                  height: '2px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.18)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
          </div>

          {/* Chat content fills remaining space */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderChatContent()}
          </div>
        </>
      ) : (
        /* No active call — normal chat layout */
        renderChatContent()
      )}
    </section>
  );
}
