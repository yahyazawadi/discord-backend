const IS_PROD = import.meta.env.MODE === 'production';

const backendHost = 'squad-j5q6.onrender.com';
const backendPort = 443;

export const PEER_CONFIG = {
  host: backendHost,
  port: backendPort,
  path: '/peerjs',
  secure: true,
  debug: IS_PROD ? 0 : 2,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Dynamically load TURN servers from env if available for firewall bypass
      ...(import.meta.env.VITE_TURN_URL ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_PASSWORD || '',
      }] : []),
    ],
  },
};
