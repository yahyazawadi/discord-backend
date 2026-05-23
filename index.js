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

// --- Cloudflare Workers Environment Patch ---
try {
  const cfWorkers = await import('cloudflare:workers');
  if (cfWorkers && cfWorkers.env) {
    console.log('📦 [Env Patch] Cloudflare environment bindings detected. Syncing with process.env...');
    for (const [key, value] of Object.entries(cfWorkers.env)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        process.env[key] = String(value);
      }
    }
  }
} catch (e) {
  console.log('ℹ️ [Env Patch] Running in non-Cloudflare environment. Using standard process.env.');
}

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

// --- Database Connection Middleware ---
let dbConnectionPromise = null;

const ensureDbConnected = async (req, res, next) => {
  // Sync Cloudflare environment variables on request in case of lazy initialization
  try {
    const cfWorkers = await import('cloudflare:workers');
    if (cfWorkers && cfWorkers.env) {
      for (const [key, value] of Object.entries(cfWorkers.env)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          process.env[key] = String(value);
        }
      }
    }
  } catch (e) {
    // Ignore on non-Cloudflare environments
  }

  const readyState = mongoose.connection.readyState;
  console.log(`📡 [DB Middleware] Request: ${req.method} ${req.path} | Connection State: ${readyState}`);
  
  if (readyState === 1) {
    return next();
  }
  
  console.log(`🔌 [DB Middleware] Database not connected (State: ${readyState}). Awaiting/Initiating connection...`);
  
  if (!dbConnectionPromise) {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      console.error('💥 [DB Middleware] Error: MONGODB_URI is undefined!');
      return res.status(500).json({
        success: false,
        error: 'Database Configuration Error',
        message: 'MONGODB_URI is not set in environment variables.'
      });
    }
    
    const maskedUri = rawUri.replace(/:([^@]+)@/, ':***@');
    console.log(`🚀 [DB Middleware] Connecting to ${maskedUri}...`);
    
    dbConnectionPromise = mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 8000,
    });
  }
  
  try {
    await dbConnectionPromise;
    console.log('✅ [DB Middleware] Connection established successfully!');
    next();
  } catch (error) {
    console.error('💥 [DB Middleware] Failed to connect to MongoDB in request middleware:', error);
    dbConnectionPromise = null; // Clear so next request retries
    res.status(500).json({
      success: false,
      error: 'Database Connection Timeout/Failure',
      message: error.message,
      state: mongoose.connection.readyState
    });
  }
};

app.use('/api', ensureDbConnected);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/messages', messageRoutes);

// Inlined landing page HTML to completely bypass filesystem reads (fs.stat is unsupported in serverless Workers)
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Squad Server - Active Node Runtime</title>
  <!-- Modern Premium Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;600&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-color: #08090c;
      --card-bg: rgba(17, 20, 28, 0.65);
      --card-border: rgba(255, 255, 255, 0.07);
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --accent-color: #5865F2;
      --glow-color: rgba(88, 101, 242, 0.25);
      --green-glow: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-color);
      color: var(--text-primary);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      position: relative;
    }

    .bg-glow-1 {
      position: absolute;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--glow-color) 0%, rgba(0,0,0,0) 70%);
      top: -10%;
      left: -10%;
      z-index: 1;
      filter: blur(80px);
      animation: pulseGlow 15s infinite alternate;
    }

    .bg-glow-2 {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%);
      bottom: -15%;
      right: -10%;
      z-index: 1;
      filter: blur(100px);
      animation: pulseGlow 20s infinite alternate;
    }

    .container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 3rem 2.5rem;
      border-radius: 24px;
      width: 90%;
      max-width: 480px;
      text-align: center;
      z-index: 10;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1);
      transform: translateY(0);
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .container:hover {
      transform: translateY(-4px);
      border-color: rgba(88, 101, 242, 0.3);
      box-shadow: 0 24px 48px rgba(88, 101, 242, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    .logo-container {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem auto;
      background: radial-gradient(135deg, #7c3aed 0%, var(--accent-color) 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(88, 101, 242, 0.4);
      position: relative;
    }

    .logo-container::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 22px;
      background: linear-gradient(135deg, #a78bfa, #5865F2);
      z-index: -1;
      opacity: 0.5;
    }

    .logo-icon {
      font-size: 2.2rem;
      font-weight: 800;
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(to bottom, #ffffff, #e2e8f0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -1px;
    }

    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #ffffff, #e2e8f0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .server-status {
      display: inline-flex;
      align-items: center;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 0.4rem 1rem;
      border-radius: 100px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--green-glow);
      margin-bottom: 2rem;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background-color: var(--green-glow);
      border-radius: 50%;
      margin-right: 0.5rem;
      box-shadow: 0 0 10px var(--green-glow), 0 0 20px var(--green-glow);
      animation: pulseStatus 2s infinite;
    }

    .info-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;
      text-align: left;
    }

    .info-item {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.03);
      padding: 0.85rem 1rem;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .info-label {
      color: var(--text-secondary);
      font-weight: 500;
    }

    .info-value {
      color: var(--text-primary);
      font-weight: 600;
      font-family: monospace;
      font-size: 0.85rem;
    }

    .badge {
      background: rgba(88, 101, 242, 0.15);
      border: 1px solid rgba(88, 101, 242, 0.3);
      color: #a5b4fc;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .footer {
      position: absolute;
      bottom: 2rem;
      font-size: 0.8rem;
      color: var(--text-secondary);
      z-index: 10;
      text-align: center;
    }

    .footer a {
      color: var(--accent-color);
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }

    .footer a:hover {
      color: #818cf8;
    }

    @keyframes pulseStatus {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
      }
    }

    @keyframes pulseGlow {
      0% {
        transform: scale(1) translate(0, 0);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.1) translate(3%, 5%);
        opacity: 1;
      }
      100% {
        transform: scale(1) translate(0, 0);
        opacity: 0.8;
      }
    }
  </style>
</head>
<body>

  <div class="bg-glow-1"></div>
  <div class="bg-glow-2"></div>

  <div class="container">
    <div class="logo-container">
      <div class="logo-icon">S</div>
    </div>
    
    <h1>Squad Server</h1>
    <div class="server-status">
      <span class="status-dot"></span>
      Active Production Runtime
    </div>

    <div class="info-list">
      <div class="info-item">
        <span class="info-label">Environment</span>
        <span class="badge">Cloudflare Workers</span>
      </div>
      <div class="info-item">
        <span class="info-label">Compatibility</span>
        <span class="info-value">NodeJS Native</span>
      </div>
      <div class="info-item">
        <span class="info-label">Database</span>
        <span class="info-value">MongoDB Cluster</span>
      </div>
      <div class="info-item">
        <span class="info-label">Endpoints</span>
        <span class="info-value" style="color: #6366f1;">/api/*</span>
      </div>
    </div>
  </div>

  <div class="footer">
    Powered by Cloudflare Workers &bull; <a href="https://github.com/yahyazawadi/squad" target="_blank">Squad Project</a>
  </div>

</body>
</html>`;

// Catch-all for non-API routes (Serve the beautiful landing page directly from memory)
app.get(/.*/, (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(htmlContent);
});

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

// Export the HTTP server handler for Cloudflare Workers
export default httpServerHandler(server);
