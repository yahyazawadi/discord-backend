const IS_PROD = import.meta.env.MODE === 'production';

// host must be ONLY the hostname — never include the port here.
// PeerJS takes host and port as separate fields and builds its own URL.
// Mixing both (e.g. 'localhost:5001') results in 'ws://localhost:5001:5001/...'
const backendHost = window.location.hostname; // 'localhost' in dev, your domain in prod

const backendPort = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 5001
  : (window.location.protocol === 'https:' ? 443 : 80);

export const PEER_CONFIG = {
  host: backendHost,
  port: backendPort,
  path: '/peerjs',
  secure: window.location.protocol === 'https:' || IS_PROD,
  debug: IS_PROD ? 0 : 2,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};
