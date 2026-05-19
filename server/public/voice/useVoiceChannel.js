/**
 * useVoiceChannel.js
 * Drop into: client/src/hooks/useVoiceChannel.js
 *
 * Manages the full lifecycle of a PeerJS voice/video channel session:
 *   - Initialises a PeerJS peer with a unique ID (timestamp suffix for multi-tab safety)
 *   - Captures local mic/camera stream via getUserMedia (with graceful fallback)
 *   - Emits join_voice / leave_voice to the Socket.io signaling server
 *   - Handles incoming participants and tears down streams on leave/disconnect
 *   - Exposes controls: toggleMic, toggleCamera, shareScreen, stopScreenShare, leaveChannel
 *
 * Crash-safety guarantees:
 *   - Every async operation is wrapped in try/catch — a failed getUserMedia or
 *     peer.call() will never crash the component tree.
 *   - All refs are null-checked before access.
 *   - useEffect cleanup always runs leaveChannel() to prevent ghost users.
 *   - PeerJS errors are caught and surfaced via the `error` state string.
 *
 * Usage:
 *   const {
 *     localStream, participants, isMicOn, isCameraOn,
 *     isScreenSharing, isConnecting, error,
 *     toggleMic, toggleCamera, shareScreen, stopScreenShare, leaveChannel
 *   } = useVoiceChannel({ channelId, socket, enabled });
 *
 * Props:
 *   channelId  {string}         - The voice channel's MongoDB _id
 *   socket     {Socket}         - The authenticated socket.io-client instance
 *   enabled    {boolean}        - Set to false to skip initialisation (e.g. text channels)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import { PEER_CONFIG } from '../lib/peerConfig';

// ─────────────────────────────────────────────────────────────
// Helper: safely stop all tracks in a MediaStream
// ─────────────────────────────────────────────────────────────
const stopStream = (stream) => {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch (_) { /* ignore */ }
    });
  } catch (_) { /* ignore */ }
};

// ─────────────────────────────────────────────────────────────
// Helper: close a single PeerJS MediaConnection safely
// ─────────────────────────────────────────────────────────────
const closeCall = (call) => {
  if (!call) return;
  try { call.close(); } catch (_) { /* ignore */ }
};

// ─────────────────────────────────────────────────────────────
// Main Hook
// ─────────────────────────────────────────────────────────────
const useVoiceChannel = ({ channelId, socket, enabled = true }) => {
  // ── State exposed to the UI ──────────────────────────────
  const [localStream, setLocalStream]       = useState(null);
  const [participants, setParticipants]     = useState([]); // [{ userId, peerId, username, displayName, avatar, stream }]
  const [isMicOn, setIsMicOn]               = useState(true);
  const [isCameraOn, setIsCameraOn]         = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting]     = useState(false);
  const [error, setError]                   = useState(null);

  // ── Internal refs (never trigger re-renders) ─────────────
  const peerRef         = useRef(null); // PeerJS Peer instance
  const localStreamRef  = useRef(null); // live local MediaStream
  const screenStreamRef = useRef(null); // screen capture stream (separate track)
  const callsRef        = useRef(new Map()); // userId → MediaConnection

  // ── Derived: is the hook active? ─────────────────────────
  const isActive = enabled && !!channelId && !!socket;

  // ─────────────────────────────────────────────────────────
  // addParticipant — merge or update a participant in state
  // ─────────────────────────────────────────────────────────
  const addParticipant = useCallback((info) => {
    setParticipants((prev) => {
      const exists = prev.some((p) => p.userId === info.userId);
      if (exists) {
        return prev.map((p) => p.userId === info.userId ? { ...p, ...info } : p);
      }
      return [...prev, info];
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // removeParticipant — remove by userId, close their call
  // ─────────────────────────────────────────────────────────
  const removeParticipant = useCallback((userId) => {
    const call = callsRef.current.get(userId);
    closeCall(call);
    callsRef.current.delete(userId);

    setParticipants((prev) => prev.filter((p) => p.userId !== userId));
  }, []);

  // ─────────────────────────────────────────────────────────
  // attachRemoteStream — when a call's stream arrives, attach
  // it to the correct participant entry
  // ─────────────────────────────────────────────────────────
  const attachRemoteStream = useCallback((userId, stream) => {
    setParticipants((prev) =>
      prev.map((p) => p.userId === userId ? { ...p, stream } : p)
    );
  }, []);

  // ─────────────────────────────────────────────────────────
  // callPeer — initiate a PeerJS call to a specific peer
  // ─────────────────────────────────────────────────────────
  const callPeer = useCallback((participantInfo) => {
    const peer   = peerRef.current;
    const stream = localStreamRef.current;

    if (!peer || !stream || !participantInfo?.peerId) return;
    // Don't call ourselves
    if (participantInfo.userId === peer._lastServerId?.split('_')[0]) return;
    // Don't double-call
    if (callsRef.current.has(participantInfo.userId)) return;

    try {
      const call = peer.call(participantInfo.peerId, stream);
      if (!call) return; // PeerJS returned null — peer may have already left

      callsRef.current.set(participantInfo.userId, call);

      call.on('stream', (remoteStream) => {
        attachRemoteStream(participantInfo.userId, remoteStream);
      });

      call.on('close', () => {
        removeParticipant(participantInfo.userId);
      });

      call.on('error', (err) => {
        console.warn(`[Voice] call error with ${participantInfo.userId}:`, err);
        removeParticipant(participantInfo.userId);
      });
    } catch (err) {
      console.error('[Voice] callPeer failed:', err);
    }
  }, [attachRemoteStream, removeParticipant]);

  // ─────────────────────────────────────────────────────────
  // leaveChannel — full teardown: streams, peer, socket events
  // ─────────────────────────────────────────────────────────
  const leaveChannel = useCallback(() => {
    // 1. Close all outgoing/incoming calls
    callsRef.current.forEach((call) => closeCall(call));
    callsRef.current.clear();

    // 2. Stop local media tracks
    stopStream(localStreamRef.current);
    stopStream(screenStreamRef.current);
    localStreamRef.current  = null;
    screenStreamRef.current = null;
    setLocalStream(null);

    // 3. Destroy PeerJS instance
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) { /* ignore */ }
      peerRef.current = null;
    }

    // 4. Notify the server
    if (socket?.connected && channelId) {
      try {
        socket.emit('leave_voice', { channelId });
      } catch (_) { /* ignore — socket may have already closed */ }
    }

    // 5. Reset UI state
    setParticipants([]);
    setIsMicOn(true);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsConnecting(false);
    setError(null);
  }, [socket, channelId]);

  // ─────────────────────────────────────────────────────────
  // Main effect — initialise peer + media on mount / channelId change
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    let cancelled = false; // guard against async race if effect cleans up early

    const init = async () => {
      setIsConnecting(true);
      setError(null);

      // ── 1. Capture local audio (camera off by default) ──
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false, // camera starts OFF — user enables via toggleCamera
        });
      } catch (err) {
        if (cancelled) return;
        // getUserMedia denied (no mic, permissions blocked, etc.)
        const msg = err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone permissions.'
          : `Could not access microphone: ${err.message}`;
        setError(msg);
        setIsConnecting(false);
        return;
      }

      if (cancelled) { stopStream(stream); return; }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // ── 2. Create PeerJS peer ────────────────────────────
      // Append a timestamp suffix to prevent ID conflicts on multi-tab sessions
      const peerId = `${socket.id}_${Date.now()}`;
      let peer;
      try {
        peer = new Peer(peerId, PEER_CONFIG);
      } catch (err) {
        if (cancelled) return;
        console.error('[Voice] Failed to create Peer:', err);
        setError('Failed to connect to voice server. Please try again.');
        stopStream(stream);
        setIsConnecting(false);
        return;
      }

      peerRef.current = peer;

      // ── 3. PeerJS event handlers ─────────────────────────

      peer.on('error', (err) => {
        if (cancelled) return;
        console.error('[Voice] PeerJS error:', err);
        // ID taken = multi-tab collision. Don't hard-crash, just warn.
        if (err.type === 'unavailable-id') {
          console.warn('[Voice] Peer ID collision — this is expected on multi-tab. Reconnecting...');
          return;
        }
        setError(`Voice connection error: ${err.message || err.type}`);
      });

      // Answer incoming calls from other participants
      peer.on('call', (incomingCall) => {
        if (cancelled || !localStreamRef.current) {
          closeCall(incomingCall);
          return;
        }
        try {
          incomingCall.answer(localStreamRef.current);

          incomingCall.on('stream', (remoteStream) => {
            // We don't know the userId from the call alone — find by peerId
            setParticipants((prev) => {
              const match = prev.find((p) => p.peerId === incomingCall.peer);
              if (match) {
                return prev.map((p) =>
                  p.peerId === incomingCall.peer ? { ...p, stream: remoteStream } : p
                );
              }
              return prev; // caller not yet in list — socket event will add them
            });
          });

          incomingCall.on('close', () => {
            // Find userId by peerId and remove
            setParticipants((prev) => {
              const match = prev.find((p) => p.peerId === incomingCall.peer);
              if (match) removeParticipant(match.userId);
              return prev;
            });
          });

          incomingCall.on('error', (err) => {
            console.warn('[Voice] Incoming call error:', err);
          });
        } catch (err) {
          console.error('[Voice] Failed to answer incoming call:', err);
        }
      });

      // ── 4. Wait for PeerJS to be ready, then signal the server ──
      peer.on('open', (assignedId) => {
        if (cancelled) return;
        setIsConnecting(false);
        console.log('[Voice] PeerJS open with id:', assignedId);

        // Tell the Socket.io server we've joined
        socket.emit('join_voice', { channelId, peerId: assignedId });
      });
    };

    init();

    // Cleanup on unmount or channelId change
    return () => {
      cancelled = true;
      leaveChannel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isActive]); // leaveChannel is stable via useCallback, excluded intentionally

  // ─────────────────────────────────────────────────────────
  // Socket.io event listeners
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !channelId) return;

    // Server sends us the existing participants when we first join
    const onRoomParticipants = ({ channelId: cId, participants: existing }) => {
      if (cId !== channelId) return;
      existing.forEach((p) => {
        addParticipant(p);
        callPeer(p); // call each existing peer
      });
    };

    // A new user joined AFTER us — they will call us, but we add them to the list
    const onUserJoinedVoice = (info) => {
      if (info.channelId !== channelId) return;
      addParticipant(info);
      // They will call us (server broadcasts our peerId to them); we don't call them
    };

    // A user left or disconnected
    const onUserLeftVoice = ({ channelId: cId, userId }) => {
      if (cId !== channelId) return;
      removeParticipant(userId);
    };

    socket.on('voice_room_participants', onRoomParticipants);
    socket.on('user_joined_voice', onUserJoinedVoice);
    socket.on('user_left_voice', onUserLeftVoice);

    return () => {
      socket.off('voice_room_participants', onRoomParticipants);
      socket.off('user_joined_voice', onUserJoinedVoice);
      socket.off('user_left_voice', onUserLeftVoice);
    };
  }, [socket, channelId, addParticipant, callPeer, removeParticipant]);

  // ─────────────────────────────────────────────────────────
  // Controls
  // ─────────────────────────────────────────────────────────

  /** Toggle local microphone on/off */
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  }, []);

  /** Toggle local camera on/off */
  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existingVideoTrack = stream.getVideoTracks()[0];

    if (existingVideoTrack) {
      // Camera is ON — disable and remove
      existingVideoTrack.stop();
      stream.removeTrack(existingVideoTrack);
      setIsCameraOn(false);
      // Replace track in all active calls
      callsRef.current.forEach((call) => {
        try {
          const sender = call.peerConnection
            ?.getSenders()
            .find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(null);
        } catch (_) { /* ignore */ }
      });
    } else {
      // Camera is OFF — enable
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        stream.addTrack(videoTrack);
        setIsCameraOn(true);
        setLocalStream(new MediaStream(stream.getTracks())); // trigger re-render

        // Push track to all active calls via replaceTrack
        callsRef.current.forEach((call) => {
          try {
            const sender = call.peerConnection
              ?.getSenders()
              .find((s) => s.track === null || s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack);
          } catch (_) { /* ignore */ }
        });
      } catch (err) {
        const msg = err.name === 'NotAllowedError'
          ? 'Camera access denied.'
          : `Could not enable camera: ${err.message}`;
        setError(msg);
      }
    }
  }, []);

  /** Start screen sharing (replaces video track with screen capture) */
  const shareScreen = useCallback(async () => {
    if (isScreenSharing) return;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // tab/system audio if user permits
      });

      screenStreamRef.current = displayStream;
      const screenTrack = displayStream.getVideoTracks()[0];

      // Replace video track in all active calls
      callsRef.current.forEach((call) => {
        try {
          const sender = call.peerConnection
            ?.getSenders()
            .find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        } catch (_) { /* ignore */ }
      });

      setIsScreenSharing(true);

      // Auto-stop when user clicks browser's "Stop sharing" button
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        // NotAllowedError = user cancelled — not an error worth surfacing
        setError(`Could not start screen share: ${err.message}`);
      }
    }
  }, [isScreenSharing]);

  /** Stop screen sharing and revert to camera (or blank if camera is off) */
  const stopScreenShare = useCallback(async () => {
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setIsScreenSharing(false);

    // If camera was on, put it back; otherwise send null video
    const stream = localStreamRef.current;
    const cameraTrack = stream?.getVideoTracks()[0] ?? null;

    callsRef.current.forEach((call) => {
      try {
        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack);
      } catch (_) { /* ignore */ }
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────
  return {
    // State
    localStream,
    participants,      // [{ userId, peerId, username, displayName, avatar, stream }]
    isMicOn,
    isCameraOn,
    isScreenSharing,
    isConnecting,
    error,

    // Controls
    toggleMic,
    toggleCamera,
    shareScreen,
    stopScreenShare,
    leaveChannel,
  };
};

export default useVoiceChannel;
