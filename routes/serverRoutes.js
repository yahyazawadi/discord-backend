import express from 'express';
import {
  createServer,
  getServers,
  getServerDetails,
  exploreServers,
  updateServer,
  joinServerByInvite,
  joinServerDirect,
  leaveServer,
  kickMember,
  banMember,
  editMemberNickname,
  createCategory,
  createChannel,
  subscribeChannel,
  muteChannel,
  muteCategory,
  generateServerInvite,
  deleteServer,
  promoteToAdmin,
  demoteAdmin,
  getServerByInviteCode,
} from '../controllers/serverController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Server collection endpoints
router.post('/', protect, createServer);
router.get('/', protect, getServers);
router.get('/explore', protect, exploreServers);

// Invite generation endpoint
router.post('/invite', protect, generateServerInvite);

// Invite-code join endpoint
router.post('/join/:inviteCode', protect, joinServerByInvite);

// Invite details public endpoint
router.get('/invite-details/:inviteCode', getServerByInviteCode);

// Specific server detail and join/leave/moderation endpoints
router.get('/:serverId', optionalAuth, getServerDetails);
router.put('/:serverId', protect, updateServer);
router.post('/:serverId/join-direct', protect, joinServerDirect);
router.post('/:serverId/leave', protect, leaveServer);
router.post('/:serverId/kick/:userId', protect, kickMember);
router.post('/:serverId/ban/:userId', protect, banMember);

// Nickname customization endpoint
router.put('/:serverId/nickname', protect, editMemberNickname);

// Channel and Category manipulation endpoints
router.post('/:serverId/categories', protect, createCategory);
router.post('/:serverId/channels', protect, createChannel);
router.post('/:serverId/channels/:channelId/subscribe', protect, subscribeChannel);
router.post('/:serverId/channels/:channelId/mute', protect, muteChannel);
router.post('/:serverId/categories/:categoryId/mute', protect, muteCategory);

// Admin promotion / demotion (owner-only)
router.post('/:serverId/admins/:userId', protect, promoteToAdmin);
router.delete('/:serverId/admins/:userId', protect, demoteAdmin);

// Delete server (owner-only)
router.delete('/:serverId', protect, deleteServer);

export default router;
