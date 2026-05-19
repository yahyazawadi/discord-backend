import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import rateLimit from 'express-rate-limit';
import xss from 'xss-clean';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

// Connect to MongoDB
// Uncomment below when MONGODB_URI is provided in .env
// connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Initialize PeerJS Server
const peerServer = ExpressPeerServer(server, {
  debug: process.env.NODE_ENV !== 'production',
  path: '/',
});

// Use PeerJS router
app.use('/peerjs', peerServer);

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
app.use(xss()); // Sanitize data against XSS
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); // Logging
}

// --- Routes ---
app.get('/', (req, res) => {
  res.send('Discord Clone API & PeerJS/Socket Engine is running...');
});

// TODO: Mount Routers here
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

// --- Socket.io Logic ---
io.on('connection', (socket) => {
  console.log(`User connected to Socket.io: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
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
    // mongoose.connection.close(false, () => {
    //   console.log('MongoDB connection closed.');
      process.exit(0);
    // });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
