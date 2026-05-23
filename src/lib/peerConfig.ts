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
      // Open Relay Project (Free public TURN fallback to bypass strict firewalls/NATs out-of-the-box)
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Dynamically load user TURN servers from env if available
      ...(import.meta.env.VITE_TURN_URL ? [{
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_PASSWORD || '',
      }] : []),
    ],
  },
};
