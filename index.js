import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import http from 'node:http';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
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
import inviteTrie from './utils/inviteTrie.js';
import { join } from 'path';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Database & Trie Cache
const initializeDatabase = async () => {
  try {
    // 1. Seed System User
    const systemUserExists = await User.findOne({ email: 'system@squad.chat' });
    if (!systemUserExists) {
      const systemUser = new User({
        username: 'System',
        displayName: 'System',
        email: 'system@squad.chat',
        password: new mongoose.Types.ObjectId().toString(),
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
};

// Connect to MongoDB
connectDB().then(() => {
  initializeDatabase();
});

// --- Middleware ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(customXss);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Serve static public assets
app.use(express.static(join(process.cwd(), 'public')));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);

// Catch-all for SPA (Client-side routing)
app.get(/.*/, (req, res) => {
  res.sendFile(join(process.cwd(), 'public', 'index.html'));
});

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

// Export the HTTP server handler for Cloudflare Workers
export default httpServerHandler(server);
