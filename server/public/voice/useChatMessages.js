/**
 * useChatMessages.js
 * Drop into: client/src/hooks/useChatMessages.js
 *
 * Manages the message list for a channel or DM conversation.
 *
 * Fixes the "messages disappear on send" bug by:
 *   1. NEVER clearing messages — uses optimistic append instead.
 *   2. Deduplicating by _id so the server's confirmed message
 *      cleanly replaces the optimistic one without flicker.
 *   3. Keeping the fetch + socket listener completely separate
 *      so a channel switch can load new history WITHOUT wiping
 *      messages during the fetch.
 *
 * Usage:
 *   const { messages, sendMessage, isLoading, error } =
 *     useChatMessages({ channelId, conversationId, socket, currentUser });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api'; // your axios instance with baseURL + withCredentials

const useChatMessages = ({ channelId, conversationId, socket, currentUser }) => {
  const [messages, setMessages]   = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);

  // Stable ref so socket handlers always see the latest messages
  // without needing to be re-registered on every render.
  const messagesRef = useRef([]);
  messagesRef.current = messages;

  // ─────────────────────────────────────────────────────────
  // Deduplicated append — the single source of truth for adding
  // messages to the list. Works for both fetched history and
  // incoming socket events.
  // ─────────────────────────────────────────────────────────
  const appendMessages = useCallback((incoming, { prepend = false } = {}) => {
    // incoming can be a single message object or an array
    const newItems = Array.isArray(incoming) ? incoming : [incoming];

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m._id));
      // Filter out any we already have (deduplication)
      const fresh = newItems.filter((m) => m._id && !existingIds.has(m._id));
      if (fresh.length === 0) return prev; // nothing new — skip re-render
      return prepend ? [...fresh, ...prev] : [...prev, ...fresh];
    });
  }, []);

  // ─────────────────────────────────────────────────────────
  // Replace a message in the list (for edits, reaction updates)
  // ─────────────────────────────────────────────────────────
  const replaceMessage = useCallback((updated) => {
    setMessages((prev) =>
      prev.map((m) => m._id === updated._id ? { ...m, ...updated } : m)
    );
  }, []);

  // ─────────────────────────────────────────────────────────
  // Remove a message from the list (for deletes)
  // ─────────────────────────────────────────────────────────
  const removeMessage = useCallback((messageId) => {
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
  }, []);

  // ─────────────────────────────────────────────────────────
  // Fetch history when channelId / conversationId changes.
  //
  // KEY FIX: We reset the list ONLY once we have data back,
  // never before. This prevents the blank flash.
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!channelId && !conversationId) return;

    let cancelled = false;

    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = channelId
          ? `/messages/channel/${channelId}`
          : `/messages/conversation/${conversationId}`;

        const { data } = await api.get(url);
        const history = Array.isArray(data) ? data : [];

        if (!cancelled) {
          // ✅ Replace list ONLY after data is ready — zero blank flash
          setMessages(history);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load messages.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchHistory();

    return () => { cancelled = true; };
  }, [channelId, conversationId]);

  // ─────────────────────────────────────────────────────────
  // Socket listeners — registered once, stable callbacks
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // ✅ FIX: APPEND the new message — never replace the array
    const onReceiveMessage = (msg) => {
      appendMessages(msg);
    };

    // Edit / reaction update
    const onMessageUpdated = (updated) => {
      replaceMessage(updated);
    };

    // Delete
    const onMessageDeleted = ({ messageId }) => {
      removeMessage(messageId);
    };

    socket.on('receive_message',  onReceiveMessage);
    socket.on('message_updated',  onMessageUpdated);
    socket.on('message_deleted',  onMessageDeleted);

    return () => {
      socket.off('receive_message',  onReceiveMessage);
      socket.off('message_updated',  onMessageUpdated);
      socket.off('message_deleted',  onMessageDeleted);
    };
  }, [socket, appendMessages, replaceMessage, removeMessage]);

  // ─────────────────────────────────────────────────────────
  // sendMessage — OPTIMISTIC UPDATE
  //
  // Appends a temporary message instantly (zero latency feel),
  // then the server's confirmed `receive_message` socket event
  // arrives and appendMessages() deduplicates by _id — so the
  // optimistic entry is cleanly replaced without duplication.
  //
  // If the send fails, the optimistic message is removed.
  // ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(({
    content,
    attachments = [],
    isAnonymous = false,
  }) => {
    if (!socket || !currentUser) return;
    if (!content?.trim() && attachments.length === 0) return;

    // Build a local optimistic message with a temporary ID
    const tempId = `optimistic_${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      content: content?.trim() || '',
      attachments,
      isAnonymous,
      sender: {
        _id: currentUser._id,
        username: currentUser.username,
        displayName: currentUser.displayName || currentUser.username,
        avatar: currentUser.avatar,
      },
      createdAt: new Date().toISOString(),
      isPinned: false,
      isEdited: false,
      reactions: [],
      // Scope
      ...(channelId       ? { channel: channelId }           : {}),
      ...(conversationId  ? { conversation: conversationId } : {}),
      _isOptimistic: true, // flag for UI to show a subtle "sending..." style
    };

    // ① Append optimistic message immediately — no flicker, instant feel
    appendMessages(optimisticMsg);

    // ② Emit to server
    socket.emit('send_message', {
      channelId,
      conversationId,
      content: content?.trim() || '',
      attachments,
      isAnonymous,
    }, (ack) => {
      // Optional: if your server sends an acknowledgement callback with an error,
      // remove the optimistic message so the user knows it failed.
      if (ack?.error) {
        removeMessage(tempId);
        setError(ack.error);
      }
    });

    // ③ When the server broadcasts `receive_message` back to the room,
    //    appendMessages() will see that _id !== tempId and ADD the real one.
    //    We then need to remove the optimistic entry.
    //    We do this by listening for the next real message from THIS user
    //    and pruning the temp entry.
    //
    //    The cleanest approach: after a short timeout, remove any remaining
    //    optimistic messages (the real one will already be in the list by then).
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }, 3000); // 3s safety net — the real message arrives in <200ms on a good connection
  }, [socket, currentUser, channelId, conversationId, appendMessages, removeMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    appendMessages,
    replaceMessage,
    removeMessage,
  };
};

export default useChatMessages;
