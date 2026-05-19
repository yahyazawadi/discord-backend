import express from 'express';
import {
  getUploadUrl,
  getChannelMessages,
  getConversationMessages,
  togglePinMessage,
  editMessage,
  deleteMessage,
  searchMessages,
  getUserConversations,
  getOrCreateConversation
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Search messages
router.get('/search', protect, searchMessages);

// R2 Presigned Upload URL
router.post('/upload-url', protect, getUploadUrl);

// Conversations management
router.get('/conversations', protect, getUserConversations);
router.post('/conversations', protect, getOrCreateConversation);

// Retrieve messages
router.get('/channel/:channelId', protect, getChannelMessages);
router.get('/conversation/:conversationId', protect, getConversationMessages);

// Actions on single message
router.put('/pin/:messageId', protect, togglePinMessage);
router.put('/edit/:messageId', protect, editMessage);
router.delete('/:messageId', protect, deleteMessage);

export default router;
