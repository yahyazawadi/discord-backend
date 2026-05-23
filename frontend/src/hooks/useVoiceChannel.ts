import { useState, useEffect, useRef, useCallback } from "react";
import Peer from "peerjs";
import type { MediaConnection } from "peerjs";
import { PEER_CONFIG } from "../lib/peerConfig";

export interface VoiceParticipant {
  userId: string;
  peerId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  stream?: MediaStream;
}

interface Props { channelId: string | null; socket: any; enabled?: boolean; callType?: "audio" | "video" | null; }

const stopStream = (s: MediaStream | null) => { try { s?.getTracks().forEach(t => { try { t.stop(); } catch(_){} }); } catch(_){} };
const closeCall  = (c: MediaConnection | null) => { try { c?.close(); } catch(_){} };

const useVoiceChannel = ({ channelId, socket, enabled = true, callType = "audio" }: Props) => {
  const [localStream,     setLocalStream]     = useState<MediaStream | null>(null);
  const [participants,    setParticipants]    = useState<VoiceParticipant[]>([]);
  const [isMicOn,         setIsMicOn]         = useState(true);
  const [isCameraOn,      setIsCameraOn]      = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isConnecting,    setIsConnecting]    = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const peerRef     = useRef<Peer | null>(null);
  const localRef    = useRef<MediaStream | null>(null);
  const screenRef   = useRef<MediaStream | null>(null);
  const outgoingRef = useRef<MediaStream | null>(null);

  // ONE connection per remote peerId — this is the single source of truth
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());

  const pendingRef      = useRef<VoiceParticipant[]>([]);
  const peerInfoRef     = useRef<Map<string, VoiceParticipant>>(new Map()); // userId  -> info
  const peerIdToInfoRef = useRef<Map<string, VoiceParticipant>>(new Map()); // peerId -> info

  const isActive = enabled && !!channelId && !!socket;

  // ── helpers ──────────────────────────────────────────────────────────────

  const upsertParticipant = useCallback((info: VoiceParticipant) => {
    setParticipants(prev => {
      const idx = prev.findIndex(p => p.userId === info.userId);
      if (idx === -1) return [...prev, info];
      return prev.map((p, i) => (i === idx ? { ...p, ...info } : p));
    });
  }, []);

  // Attach a remote stream 1 second after it arrives (let ICE settle)
  const attachStream = useCallback((peerId: string, remote: MediaStream) => {
    setTimeout(() => {
      setParticipants(prev => {
        const idx = prev.findIndex(p => p.peerId === peerId);
        if (idx !== -1) return prev.map((p, i) => (i === idx ? { ...p, stream: remote } : p));
        const info = peerIdToInfoRef.current.get(peerId);
        if (info) return [...prev, { ...info, stream: remote }];
        return [...prev, { userId: peerId, peerId, username: "Unknown", displayName: "Unknown", avatar: null, stream: remote }];
      });
    }, 1000);
  }, []);

  /**
   * The ONLY place a call is created.
   * Rule: if a connection to this peerId already exists in callsRef, skip — no duplicates.
   */
  const connectToUser = useCallback((peerId: string, stream: MediaStream, info: VoiceParticipant) => {
    const peer = peerRef.current;
    if (!peer || !stream) return;

    // Already connected — do nothing
    if (callsRef.current.has(peerId)) {
      console.log("[Voice] Already connected to", peerId, "— skipping");
      return;
    }

    console.log("[Voice] Connecting to", peerId, info.displayName);
    peerInfoRef.current.set(info.userId, info);
    peerIdToInfoRef.current.set(peerId, info);
    upsertParticipant(info);

    try {
      const call = peer.call(peerId, stream);
      if (!call) { console.warn("[Voice] peer.call() returned null"); return; }
      callsRef.current.set(peerId, call);

      call.on("stream", remote => {
        console.log("[Voice] Remote stream received from", peerId);
        attachStream(peerId, remote);
      });
      call.on("close", () => { callsRef.current.delete(peerId); setParticipants(prev => prev.filter(p => p.peerId !== peerId)); });
      call.on("error", () => { callsRef.current.delete(peerId); });
    } catch (e) { console.error("[Voice] connectToUser error:", e); }
  }, [upsertParticipant, attachStream]);

  const renegotiate = useCallback(async (newStream: MediaStream) => {
    const peerIds = [...callsRef.current.keys()];
    if (!peerIds.length) return;
    callsRef.current.forEach(c => { try { c.close(); } catch(_){} });
    callsRef.current.clear();
    setParticipants(prev => prev.map(p => ({ ...p, stream: undefined })));
    await new Promise(r => setTimeout(r, 600));
    peerIds.forEach(pid => {
      const info = peerIdToInfoRef.current.get(pid);
      if (info) connectToUser(pid, newStream, info);
    });
  }, [connectToUser]);

  const cleanupStaleSession = useCallback((userId: string, newPeerId: string) => {
    const oldInfo = peerInfoRef.current.get(userId);
    if (oldInfo && oldInfo.peerId !== newPeerId) {
      console.log("[Voice] Stale session detected for user", userId, "oldPeerId:", oldInfo.peerId);
      const oldCall = callsRef.current.get(oldInfo.peerId);
      if (oldCall) {
        try { oldCall.close(); } catch(_){}
        callsRef.current.delete(oldInfo.peerId);
      }
      peerIdToInfoRef.current.delete(oldInfo.peerId);
    }
  }, []);

  const initiateConnectionFlow = useCallback((p: VoiceParticipant) => {
    // If we have video, we call immediately.
    // If we don't, we wait 1.5 seconds to let them call us first (if they have video).
    const hasLocalVideo = outgoingRef.current && outgoingRef.current.getVideoTracks().length > 0;
    if (hasLocalVideo) {
      connectToUser(p.peerId, outgoingRef.current || localRef.current!, p);
    } else {
      console.log("[Voice] Delaying outgoing call to allow video exchange:", p.displayName);
      setTimeout(() => {
        if (peerRef.current && !callsRef.current.has(p.peerId)) {
          connectToUser(p.peerId, outgoingRef.current || localRef.current!, p);
        }
      }, 1500);
    }
  }, [connectToUser]);

  const leaveChannel = useCallback(() => {
    callsRef.current.forEach(c => closeCall(c));
    callsRef.current.clear();
    stopStream(localRef.current); stopStream(screenRef.current);
    localRef.current = null; screenRef.current = null; outgoingRef.current = null;
    setLocalStream(null);
    if (peerRef.current) { try { peerRef.current.destroy(); } catch(_){} peerRef.current = null; }
    if (socket?.connected && channelId) { try { socket.emit("leave_voice", { channelId }); } catch(_){} }
    pendingRef.current = [];
    peerInfoRef.current.clear();
    peerIdToInfoRef.current.clear();
    setParticipants([]); setIsMicOn(true); setIsCameraOn(false);
    setIsScreenSharing(false); setIsConnecting(false); setError(null);
  }, [socket, channelId]);

  // ── init / teardown ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    const init = async () => {
      setIsConnecting(true); setError(null); pendingRef.current = [];

      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints =
          callType === "video"
            ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: true }
            : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e: any) {
        if (cancelled) return;
        setError(e.name === "NotAllowedError" ? "Microphone/Camera access denied." : `Media error: ${e.message}`);
        setIsConnecting(false); return;
      }
      if (cancelled) { stopStream(stream); return; }

      localRef.current = stream;
      outgoingRef.current = stream;
      setLocalStream(stream);
      if (callType === "video") setIsCameraOn(true);

      let peer: Peer;
      try { peer = new Peer(PEER_CONFIG as any); }
      catch (e: any) {
        if (cancelled) return;
        setError("Failed to connect to voice server."); stopStream(stream); setIsConnecting(false); return;
      }
      peerRef.current = peer;

      peer.on("error", (e: any) => {
        if (cancelled || e.type === "unavailable-id") return;
        setError(`Voice error: ${e.type}`);
      });
      peer.on("disconnected", () => { try { peer.reconnect(); } catch(_){} });

      // Incoming call handler
      // Rule: if we already have a connection to this peer, drop the duplicate.
      // Otherwise answer and register in callsRef — same as outgoing connections.
      peer.on("call", incoming => {
        if (cancelled || !localRef.current) { closeCall(incoming); return; }

        if (callsRef.current.has(incoming.peer)) {
          console.log("[Voice] Duplicate call from", incoming.peer, "— dropping");
          closeCall(incoming);
          return;
        }

        console.log("[Voice] Answering call from", incoming.peer);
        incoming.answer(outgoingRef.current || localRef.current!);
        callsRef.current.set(incoming.peer, incoming);

        incoming.on("stream", remote => {
          console.log("[Voice] Remote stream received (answer) from", incoming.peer);
          attachStream(incoming.peer, remote);
        });
        incoming.on("close", () => { callsRef.current.delete(incoming.peer); setParticipants(prev => prev.filter(p => p.peerId !== incoming.peer)); });
        incoming.on("error", () => { callsRef.current.delete(incoming.peer); });
      });

      peer.on("open", assignedId => {
        if (cancelled) return;
        setIsConnecting(false);
        console.log("[Voice] PeerJS open:", assignedId);
        socket.emit("join_voice", { channelId, peerId: assignedId });

        // Drain buffered participants (arrived before peer was ready)
        const buffered = pendingRef.current.slice();
        pendingRef.current = [];
        buffered.forEach(p => initiateConnectionFlow(p));
      });
    };

    init();
    return () => { cancelled = true; leaveChannel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isActive]);

  // ── socket signaling ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !channelId) return;

    // Existing participants when we join — we call each of them
    const onRoomParticipants = ({ channelId: cId, participants: existing }: any) => {
      if (cId !== channelId) return;
      console.log("[Voice] voice_room_participants:", existing.length, "peers");
      existing.forEach((p: VoiceParticipant) => {
        cleanupStaleSession(p.userId, p.peerId);

        peerInfoRef.current.set(p.userId, p);
        peerIdToInfoRef.current.set(p.peerId, p);
        upsertParticipant(p);
        const peerOpen = peerRef.current && (peerRef.current as any).open;
        if (!peerOpen) {
          if (!pendingRef.current.some(x => x.userId === p.userId)) pendingRef.current.push(p);
        } else {
          initiateConnectionFlow(p);
        }
      });
    };

    // New participant joined after us — they will call us, but also call them just in case.
    // connectToUser is idempotent: if a connection already exists it does nothing.
    const onUserJoinedVoice = (info: VoiceParticipant & { channelId: string }) => {
      if (info.channelId !== channelId) return;
      console.log("[Voice] user_joined_voice:", info.displayName);

      cleanupStaleSession(info.userId, info.peerId);

      peerInfoRef.current.set(info.userId, info);
      peerIdToInfoRef.current.set(info.peerId, info);
      upsertParticipant(info);
      
      // PROACTIVE CALL RULE FOR VIDEO/SCREEN SHARE:
      // If we are sharing video or screen, we MUST initiate the call to the joining peer
      // because our stream has video tracks, which forces WebRTC to negotiate video in the SDP.
      // If they call us (audio-only), WebRTC won't negotiate video transceivers and they won't see our stream.
      const hasLocalVideo = outgoingRef.current && outgoingRef.current.getVideoTracks().length > 0;
      if (hasLocalVideo) {
        console.log("[Voice] Proactively calling new joiner because we are sharing video/screen");
        const stream = outgoingRef.current;
        if (stream && peerRef.current && (peerRef.current as any).open) {
          connectToUser(info.peerId, stream, info);
        }
      }
    };

    const onUserLeftVoice = ({ channelId: cId, userId }: any) => {
      if (cId !== channelId) return;
      const info = peerInfoRef.current.get(userId);
      if (info) {
        closeCall(callsRef.current.get(info.peerId) ?? null);
        callsRef.current.delete(info.peerId);
        peerInfoRef.current.delete(userId);
        peerIdToInfoRef.current.delete(info.peerId);
      }
      setParticipants(prev => prev.filter(p => p.userId !== userId));
    };

    socket.on("voice_room_participants", onRoomParticipants);
    socket.on("user_joined_voice",       onUserJoinedVoice);
    socket.on("user_left_voice",         onUserLeftVoice);
    return () => {
      socket.off("voice_room_participants", onRoomParticipants);
      socket.off("user_joined_voice",       onUserJoinedVoice);
      socket.off("user_left_voice",         onUserLeftVoice);
    };
  }, [socket, channelId, connectToUser, upsertParticipant, cleanupStaleSession, initiateConnectionFlow]);

  // ── controls ──────────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const t = localRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setIsMicOn(t.enabled);
  }, []);

  const toggleCamera = useCallback(async () => {
    const stream = localRef.current;
    if (!stream) return;
    if (isCameraOn) {
      stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t); });
      setIsCameraOn(false);
      outgoingRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      await renegotiate(stream);
    } else {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.addTrack(cam.getVideoTracks()[0]);
        const combined = new MediaStream(stream.getTracks());
        outgoingRef.current = combined; setIsCameraOn(true); setLocalStream(combined);
        await renegotiate(combined);
      } catch (e: any) { setError(e.name === "NotAllowedError" ? "Camera denied." : `Camera error: ${e.message}`); }
    }
  }, [isCameraOn, renegotiate]);

  const stopScreenShare = useCallback(async () => {
    stopStream(screenRef.current); screenRef.current = null; setIsScreenSharing(false);
    const stream = localRef.current;
    if (!stream) return;
    outgoingRef.current = stream;
    setLocalStream(new MediaStream(stream.getTracks()));
    await renegotiate(stream);
  }, [renegotiate]);

  const shareScreen = useCallback(async () => {
    if (isScreenSharing) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = display.getVideoTracks()[0];
      screenRef.current = display;
      const combined = new MediaStream();
      localRef.current?.getAudioTracks().forEach(t => combined.addTrack(t));
      combined.addTrack(screenTrack);
      outgoingRef.current = combined; setIsScreenSharing(true); setLocalStream(combined);
      await renegotiate(combined);
      screenTrack.onended = () => stopScreenShare();
    } catch (e: any) { if (e.name !== "NotAllowedError") setError(`Screen share error: ${e.message}`); }
  }, [isScreenSharing, renegotiate, stopScreenShare]);

  return { localStream, participants, isMicOn, isCameraOn, isScreenSharing, isConnecting, error, toggleMic, toggleCamera, shareScreen, stopScreenShare, leaveChannel };
};

export default useVoiceChannel;
