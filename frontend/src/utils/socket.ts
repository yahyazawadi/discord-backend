import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://squad-j5q6.onrender.com';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket) return socket;

  const token = localStorage.getItem('token');
  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Setup connection logging for stability monitoring
  socket.on('connect', () => {
    console.log('⚡ Socket.io connected to server:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket.io disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.io connection error:', error.message);
  });

  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    const token = localStorage.getItem('token');
    s.auth = { token };
    s.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
