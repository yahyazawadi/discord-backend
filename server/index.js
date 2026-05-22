import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import rateLimit from 'express-rate-limit';
import { customXss } from './middleware/xss.js';

import connectDB from './config/db.js';
import mongoose from 'mongoose';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import serverRoutes from './routes/serverRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import User from './models/User.js';
import ServerModel from './models/Server.js';
import Conversation from './models/Conversation.js';
import Message from './models/Message.js';
import inviteTrie from './utils/inviteTrie.js';
import jwt from 'jsonwebtoken';
import { broadcastMessageToRoom, broadcastMessageUpdateToRoom } from './utils/socketHelpers.js';
import { join } from 'path';

const result = dotenv.config();
console.log('Dotenv config result:', result);
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Connect to MongoDB
connectDB().then(() => {
  initializeDatabase();
});

// Seed System User & Load Invite Cache
async function initializeDatabase() {
  try {
    // 1. Seed System User
    let systemUser = await User.findOne({ isSystem: true });
    if (!systemUser) {
      // Create user with a pre-hashed password string to avoid runtime hashing if not needed,
      // or save directly (pre-save hook will hash it).
      systemUser = new User({
        username: 'system',
        displayName: 'System',
        email: 'system@discord.local',
        password: 'system_secure_placeholder_password_not_for_login',
        birthdate: new Date(1970, 0, 1),
        isVerified: true,
        isSystem: true
      });
      await systemUser.save();
      console.log('Seeded mock "System" user.');
    }

    // 2. Load Invite Codes into in-memory Trie Cache
    const serversWithInvites = await ServerModel.find({ inviteCode: { $ne: null } }).select('inviteCode');
    let loadedCount = 0;
    serversWithInvites.forEach((srv) => {
      if (srv.inviteCode) {
        inviteTrie.insert(srv.inviteCode);
        loadedCount++;
      }
    });
    console.log(`Loaded ${loadedCount} active invite codes into Trie Cache.`);
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

// Capture Socket.io's upgrade listener
const socketIoUpgradeListener = server.listeners('upgrade')[0];
server.removeAllListeners('upgrade');

// Initialize PeerJS Server
const peerServer = ExpressPeerServer(server, {
  debug: process.env.NODE_ENV !== 'production',
  // NOTE: do NOT set path here — we mount at /peerjs via app.use below.
  // Setting path here AND mounting at /peerjs creates a double-path (/peerjs/peerjs).
});

// Use PeerJS router
app.use('/peerjs', peerServer);

// Capture PeerJS's upgrade listener
const peerJsUpgradeListener = server.listeners('upgrade')[0];
server.removeAllListeners('upgrade');

// Safely route upgrade events to prevent conflicts
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.startsWith('/socket.io') && socketIoUpgradeListener) {
    socketIoUpgradeListener(req, socket, head);
  } else if (url.startsWith('/peerjs') && peerJsUpgradeListener) {
    peerJsUpgradeListener(req, socket, head);
  } else {
    socket.destroy();
  }
});

// --- Middleware ---

// DDoS / Rate Limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Security & Parsing
app.use(express.json({ limit: '10kb' })); // Body parser & limit size
app.use(customXss); // Sanitize data against XSS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Serve static files from public directory
app.use(express.static('public'));

// Catch-all for SPA (Client-side routing)
app.get('*', (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'index.html'));
});

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Logging
}

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);

// Redirect direct invite links to the frontend with query param
app.get('/invite/:inviteCode', (req, res) => {
  const { inviteCode } = req.params;
  res.redirect(`/?invite=${inviteCode.toUpperCase()}`);
});


// Secure GIPHY API Proxy Routes
app.get('/api/giphy/search', async (req, res, next) => {
  try {
    const { q, limit, custom_key } = req.query;
    const apiKey = custom_key || process.env.GIPHY_API_KEY;
    const limitVal = limit || 20;
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q || '')}&limit=${limitVal}&rating=g`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.get('/api/giphy/trending', async (req, res, next) => {
  try {
    const { limit, custom_key } = req.query;
    const apiKey = custom_key || process.env.GIPHY_API_KEY || 'ExGGBvhojYdg1lK3gQrt6JZoMJbuAMYo';
    const limitVal = limit || 20;
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limitVal}&rating=g`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

// --- Socket.io Logic ---
const activeConnections = new Map(); // userId string -> Set of socket.id strings

// In-memory voice room state: channelId -> Map<userId, { peerId, username, displayName, avatar }>
const voiceRooms = new Map();

const broadcastPresence = async (userId, status) => {
  try {
    const userServers = await ServerModel.find({ 'members.user': userId });
    userServers.forEach(srv => {
      io.to(`server_${srv._id}`).emit('presence_update', { userId, status });
    });

    const userConversations = await Conversation.find({ participants: userId });
    userConversations.forEach(conv => {
      io.to(`conversation_${conv._id}`).emit('presence_update', { userId, status });
    });
  } catch (err) {
    console.error('Error broadcasting presence:', err);
  }
};

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const userIdStr = socket.user._id.toString();
  console.log(`User connected to Socket.io: ${socket.user.username} (${socket.id})`);

  // Track connection
  if (!activeConnections.has(userIdStr)) {
    activeConnections.set(userIdStr, new Set());
    await User.findByIdAndUpdate(socket.user._id, { systemStatus: 'online' });
    socket.user.systemStatus = 'online';

    // Broadcast presence: auto resolves dynamically
    const resolvedStatus = socket.user.userStatusPreference === 'auto' ? 'online' : socket.user.userStatusPreference;
    await broadcastPresence(userIdStr, resolvedStatus);
  }
  activeConnections.get(userIdStr).add(socket.id);

  // Room joining events
  socket.on('join_server', ({ serverId }) => {
    if (serverId) {
      socket.join(`server_${serverId}`);
      console.log(`Socket ${socket.id} joined server room server_${serverId}`);
    }
  });

  socket.on('leave_server', ({ serverId }) => {
    if (serverId) {
      socket.leave(`server_${serverId}`);
      console.log(`Socket ${socket.id} left server room server_${serverId}`);
    }
  });

  socket.on('join_channel', ({ channelId }) => {
    if (channelId) {
      socket.join(`channel_${channelId}`);
      console.log(`Socket ${socket.id} joined channel room channel_${channelId}`);
    }
  });

  socket.on('leave_channel', ({ channelId }) => {
    if (channelId) {
      socket.leave(`channel_${channelId}`);
      console.log(`Socket ${socket.id} left channel room channel_${channelId}`);
    }
  });

  socket.on('join_conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation room conversation_${conversationId}`);
    }
  });

  socket.on('leave_conversation', ({ conversationId }) => {
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} left conversation room conversation_${conversationId}`);
    }
  });

  // Messaging event
  socket.on('send_message', async ({ channelId, conversationId, content, attachments, isAnonymous }) => {
    try {
      if (!content && (!attachments || attachments.length === 0)) {
        return socket.emit('error', { message: 'Message content or attachments required' });
      }

      let serverId = null;
      let anonymousSenderName = '';

      if (channelId) {
        // Verify channel/server membership
        const server = await ServerModel.findOne({ 'categories.channels._id': channelId });
        if (!server) {
          return socket.emit('error', { message: 'Server or channel not found' });
        }
        const isMember = server.members.some(m => m.user && m.user.toString() === userIdStr);
        if (!isMember) {
          return socket.emit('error', { message: 'You are not a member of this server' });
        }
        serverId = server._id;

        // Anonymous name resolution
        if (isAnonymous) {
          const contextId = server._id;
          const freshUser = await User.findById(socket.user._id);
          let anonRecord = freshUser.anonymousNames.find(n => n.contextId.toString() === contextId.toString());
          if (anonRecord) {
            anonymousSenderName = anonRecord.anonymousName;
          } else {
            const nouns = ['Penguin', 'Koala', 'Panda', 'Fox', 'Owl', 'Otter', 'Badger', 'Dolphin', 'Tiger', 'Lion'];
            const adjectives = ['Curious', 'Happy', 'Clever', 'Swift', 'Sleepy', 'Quiet', 'Brave', 'Kind', 'Jolly'];
            const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
            const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
            anonymousSenderName = `${randomAdj} ${randomNoun}`;

            await User.findByIdAndUpdate(socket.user._id, {
              $push: { anonymousNames: { contextId, anonymousName: anonymousSenderName } }
            });
          }
        }
      } else if (conversationId) {
        // Verify DM conversation membership and block lists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return socket.emit('error', { message: 'Conversation not found' });
        }
        const isParticipant = conversation.participants.some(p => p.toString() === userIdStr);
        if (!isParticipant) {
          return socket.emit('error', { message: 'You are not a participant in this conversation' });
        }

        // Check block lists of both participants
        const participantA = await User.findById(conversation.participants[0]);
        const _pBId = conversation.participants.find(p => p.toString() !== userIdStr) || conversation.participants[0];
        const participantB = await User.findById(_pBId);

        if (!participantA || !participantB) {
          return socket.emit('error', { message: 'One of the participants no longer exists' });
        }

        const isBlockedA = participantA.blockedUsers.includes(participantB._id);
        const isBlockedB = participantB.blockedUsers.includes(participantA._id);

        if (isBlockedA || isBlockedB) {
          return socket.emit('error', { message: 'Message delivery failed: User has blocked communication.' });
        }
      } else {
        return socket.emit('error', { message: 'Either channelId or conversationId must be provided' });
      }

      // Save message
      const newMessage = new Message({
        server: serverId,
        channel: channelId,
        conversation: conversationId,
        sender: socket.user._id,
        content: content ? content.trim() : '',
        attachments: attachments || [],
        isAnonymous: !!isAnonymous,
        anonymousSenderName: anonymousSenderName || undefined
      });

      await newMessage.save();
      await newMessage.populate('sender', '_id username displayName avatar');

      // Broadcast via target room using targeted formatting
      const room = channelId ? `channel_${channelId}` : `conversation_${conversationId}`;
      await broadcastMessageToRoom(io, room, newMessage, !!channelId, serverId);

    } catch (err) {
      console.error('Error handling send_message:', err);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Typing Indicator
  socket.on('typing', ({ channelId, conversationId, isTyping }) => {
    const room = channelId ? `channel_${channelId}` : `conversation_${conversationId}`;
    socket.to(room).emit('user_typing', {
      userId: socket.user._id,
      username: socket.user.username,
      channelId,
      conversationId,
      isTyping
    });
  });

  // ─────────────────────────────────────────────
  // 🎙️ PeerJS Voice / Video Channel Signaling
  // ─────────────────────────────────────────────

  /**
   * join_voice — user enters a voice/video channel.
   * Payload: { channelId, peerId }
   *
   * 1. Verifies the user is a member of the parent server.
   * 2. Joins the Socket.io voice room so they receive future events.
   * 3. Sends the joining user the full list of existing participants
   *    (so their client can call each existing peer).
   * 4. Broadcasts the new participant's peerId to everyone already
   *    in the room (so they can call back).
   * 5. Records the participant in the voiceRooms in-memory map.
   */
  socket.on('join_voice', async ({ channelId, peerId }) => {
    try {
      if (!channelId || !peerId) {
        return socket.emit('error', { message: 'join_voice requires channelId and peerId' });
      }

      // Verify server membership
      const server = await ServerModel.findOne({ 'categories.channels._id': channelId });
      if (!server) {
        return socket.emit('error', { message: 'Voice channel not found' });
      }
      const isMember = server.members.some(m => m.user && m.user.toString() === userIdStr);
      if (!isMember) {
        return socket.emit('error', { message: 'Access Denied: Not a member of this server' });
      }

      const voiceRoom = `voice_${channelId}`;

      // Initialise room map if needed
      if (!voiceRooms.has(channelId)) {
        voiceRooms.set(channelId, new Map());
      }
      const roomParticipants = voiceRooms.get(channelId);

      // Build participant info for this user
      const participantInfo = {
        userId: userIdStr,
        peerId,
        username: socket.user.username,
        displayName: socket.user.displayName || socket.user.username,
        avatar: socket.user.avatar || null,
      };

      // ① Send the new joiner the current participant list BEFORE adding themselves
      const existingParticipants = Array.from(roomParticipants.values());
      socket.emit('voice_room_participants', {
        channelId,
        participants: existingParticipants,
      });

      // ② Broadcast the new peer to everyone already in the room
      socket.to(voiceRoom).emit('user_joined_voice', {
        channelId,
        ...participantInfo,
      });

      // ③ Join Socket.io room & record in-memory
      socket.join(voiceRoom);
      socket.currentVoiceChannel = channelId; // Track for anti-ghosting on disconnect
      roomParticipants.set(userIdStr, participantInfo);

      console.log(`🎙️ ${socket.user.username} joined voice channel ${channelId} with peerId ${peerId}`);
    } catch (err) {
      console.error('Error handling join_voice:', err);
      socket.emit('error', { message: 'Failed to join voice channel' });
    }
  });

  /**
   * leave_voice — user explicitly leaves a voice/video channel.
   * Payload: { channelId }
   *
   * Removes them from the voiceRooms map, leaves the Socket.io room,
   * and broadcasts 'user_left_voice' to remaining participants.
   */
  socket.on('leave_voice', ({ channelId }) => {
    if (!channelId) return;

    const voiceRoom = `voice_${channelId}`;
    const roomParticipants = voiceRooms.get(channelId);

    if (roomParticipants) {
      roomParticipants.delete(userIdStr);
      // Clean up empty rooms
      if (roomParticipants.size === 0) {
        voiceRooms.delete(channelId);
      }
    }

    socket.leave(voiceRoom);
    socket.currentVoiceChannel = null;

    // Notify remaining peers so they can tear down their WebRTC connections
    io.to(voiceRoom).emit('user_left_voice', {
      channelId,
      userId: userIdStr,
    });

    console.log(`🔇 ${socket.user.username} left voice channel ${channelId}`);
  });

  // Reactions
  socket.on('add_reaction', async ({ messageId, emoji, isAnonymous }) => {
    try {
      if (!messageId || !emoji) {
        return socket.emit('error', { message: 'messageId and emoji are required' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('error', { message: 'Message not found' });
      }

      // Verify access
      let serverId = message.server;
      if (message.server) {
        const server = await ServerModel.findById(message.server);
        if (!server) {
          return socket.emit('error', { message: 'Access Denied: Server not found' });
        }
        const isMember = server.members.some(m => m.user && m.user.toString() === userIdStr);
        if (!isMember) {
          return socket.emit('error', { message: 'Access Denied: Not a server member' });
        }
      } else if (message.conversation) {
        const conversation = await Conversation.findById(message.conversation);
        if (!conversation) {
          return socket.emit('error', { message: 'Access Denied: Conversation not found' });
        }
        const isParticipant = conversation.participants.some(p => p && p.toString() === userIdStr);
        if (!isParticipant) {
          return socket.emit('error', { message: 'Access Denied: Not a DM participant' });
        }
      }

      // Toggle reaction logic
      let reaction = message.reactions.find(r => r.emoji === emoji);
      let isNew = false;
      if (!reaction) {
        reaction = { emoji, users: [], anonymousReactors: [] };
        isNew = true;
      }

      const userIndex = reaction.users.findIndex(u => u && u.toString() === userIdStr);
      const anonIndex = reaction.anonymousReactors ? reaction.anonymousReactors.findIndex(r => r.realUserId && r.realUserId.toString() === userIdStr) : -1;

      if (userIndex > -1) {
        reaction.users.splice(userIndex, 1);
      } else if (anonIndex > -1) {
        reaction.anonymousReactors.splice(anonIndex, 1);
      } else {
        if (isAnonymous) {
          const contextId = serverId || message.conversation;
          const freshUser = await User.findById(socket.user._id);
          let anonRecord = freshUser.anonymousNames.find(n => n.contextId.toString() === contextId.toString());
          let anonymousName = '';

          if (anonRecord) {
            anonymousName = anonRecord.anonymousName;
          } else {
            const nouns = ['Penguin', 'Koala', 'Panda', 'Fox', 'Owl', 'Otter', 'Badger', 'Dolphin', 'Tiger', 'Lion'];
            const adjectives = ['Curious', 'Happy', 'Clever', 'Swift', 'Sleepy', 'Quiet', 'Brave', 'Kind', 'Jolly'];
            const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
            const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
            anonymousName = `${randomAdj} ${randomNoun}`;

            await User.findByIdAndUpdate(socket.user._id, {
              $push: { anonymousNames: { contextId, anonymousName } }
            });
          }

          reaction.anonymousReactors.push({ anonymousName, realUserId: socket.user._id });
        } else {
          reaction.users.push(socket.user._id);
        }
      }

      if (isNew) {
        message.reactions.push(reaction);
      }

      // Remove empty reactions
      message.reactions = message.reactions.filter(r => r.users.length > 0 || r.anonymousReactors.length > 0);
      await message.save();
      await message.populate('sender', '_id username displayName avatar');

      const room = message.channel ? `channel_${message.channel}` : `conversation_${message.conversation}`;
      await broadcastMessageUpdateToRoom(io, room, message, !!message.server, message.server);

    } catch (err) {
      console.error('Error handling reaction:', err);
      socket.emit('error', { message: 'Failed to process reaction' });
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.username} (${socket.id})`);

    // ── Anti-Ghosting: auto-evict from any active voice channel ──
    const activeVoiceChannel = socket.currentVoiceChannel;
    if (activeVoiceChannel) {
      const voiceRoom = `voice_${activeVoiceChannel}`;
      const roomParticipants = voiceRooms.get(activeVoiceChannel);
      if (roomParticipants) {
        roomParticipants.delete(userIdStr);
        if (roomParticipants.size === 0) {
          voiceRooms.delete(activeVoiceChannel);
        }
      }
      // Notify remaining peers so they tear down the dead WebRTC connection
      io.to(voiceRoom).emit('user_left_voice', {
        channelId: activeVoiceChannel,
        userId: userIdStr,
      });
      console.log(`👻 Anti-ghost: removed ${socket.user.username} from voice channel ${activeVoiceChannel}`);
    }

    const userSockets = activeConnections.get(userIdStr);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        activeConnections.delete(userIdStr);
        await User.findByIdAndUpdate(socket.user._id, { systemStatus: 'offline' });

        // Broadcast presence update
        const resolvedStatus = socket.user.userStatusPreference === 'auto' ? 'offline' : socket.user.userStatusPreference;
        await broadcastPresence(userIdStr, resolvedStatus);
      }
    }
  });
});

// --- Server Startup & Graceful Shutdown ---
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful Shutdown handling (SIGTERM/SIGINT)
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP/Socket/Peer server closed.');
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    }).catch((err) => {
      console.error('Error closing MongoDB connection:', err);
      process.exit(1);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Trigger hot reload after port 5000 release

