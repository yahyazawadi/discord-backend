/**
 * peerConfig.js
 * Shared PeerJS configuration for the Discord Clone client.
 *
 * Drop this into: client/src/lib/peerConfig.js
 *
 * The backend PeerJS broker is mounted at /peerjs on the same Express server
 * (single-port architecture). In production the host is your Render/Railway URL,
 * in development it falls back to localhost:5000.
 */

const IS_PROD = import.meta.env.MODE === 'production';

// Strip protocol from the backend URL so PeerJS can build its own WS URL
const rawBackendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const backendHost = rawBackendUrl
  .replace(/^https?:\/\//, '') // remove http:// or https://
  .replace(/\/$/, '');          // remove trailing slash

export const PEER_CONFIG = {
  host: backendHost,
  port: IS_PROD ? 443 : 5000,
  path: '/peerjs',
  secure: IS_PROD,           // wss in production, ws in dev
  debug: IS_PROD ? 0 : 2,    // verbose logs only in dev
  config: {
    iceServers: [
      // Google's free public STUN servers — allow NAT traversal
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  },
};
