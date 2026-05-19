import Message from '../models/Message.js';
import Server from '../models/Server.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { broadcastMessageUpdateToRoom } from '../utils/socketHelpers.js';

// Initialize S3 client for R2 lazily
let r2;
const getR2Client = () => {
  if (!r2) {
    if (
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT
    ) {
      r2 = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
      });
    }
  }
  return r2;
};


/**
 * Format reaction list to enforce anonymous stripping.
 * Owners and Admins receive both anonymous name and real user ID.
 * Standard members only receive the list of anonymous names.
 */
const formatReactions = (reactions, userId, isServerAdminOrOwner) => {
  if (!reactions) return [];
  return reactions.map(reaction => {
    const rxObj = reaction.toObject ? reaction.toObject() : reaction;
    if (isServerAdminOrOwner) {
      return rxObj;
    } else {
      return {
        emoji: rxObj.emoji,
        users: rxObj.users, // public users
        anonymousReactors: (rxObj.anonymousReactors || []).map(r => ({
          anonymousName: r.anonymousName
        }))
      };
    }
  });
};

/**
 * Format message to enforce anonymous stripping of the sender and reactors.
 */
const formatMessage = (msg, userId, isServerAdminOrOwner) => {
  const msgObj = msg.toObject ? msg.toObject() : msg;
  
  if (msgObj.reactions) {
    msgObj.reactions = formatReactions(msgObj.reactions, userId, isServerAdminOrOwner);
  }
  
  if (msgObj.isSystem || !msgObj.isAnonymous) {
    return msgObj;
  }
  
  const senderId = msgObj.sender?._id || msgObj.sender;
  const isSender = senderId && senderId.toString() === userId.toString();
  
  if (isSender || isServerAdminOrOwner) {
    return msgObj;
  } else {
    return {
      ...msgObj,
      sender: {
        _id: senderId,
        username: 'anonymous',
        displayName: msgObj.anonymousSenderName || 'Anonymous Member',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msgObj.anonymousSenderName || 'anonymous')}`
      }
    };
  }
};

/**
 * Generate a Cloudflare R2 pre-signed URL for direct client uploads
 * POST /api/messages/upload-url
 */
export const getUploadUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) {
      return res.status(400).json({ success: false, error: 'fileName and fileType are required' });
    }

    const client = getR2Client();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Cloudflare R2 is not configured on the server' });
    }

    const key = `uploads/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    
    // Determine public URL structure
    let publicUrl = '';
    if (process.env.R2_PUBLIC_URL && process.env.R2_PUBLIC_URL !== 'https://pub-placeholder.r2.dev') {
      publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    } else {
      // Fallback
      publicUrl = `${process.env.R2_ENDPOINT.replace(/\/$/, '')}/${process.env.R2_BUCKET_NAME}/${key}`;
    }

    res.json({
      success: true,
      signedUrl,
      publicUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get messages for a channel
 * GET /api/messages/channel/:channelId
 */
export const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    const server = await Server.findOne({ 'categories.channels._id': channelId });
    if (!server) {
      return res.status(404).json({ success: false, error: 'Channel or server not found' });
    }

    const isMember = server.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'You are not a member of this server' });
    }

    const isOwner = server.owner.toString() === req.user._id.toString();
    const isAdmin = server.admins.some((a) => a.toString() === req.user._id.toString());
    const isServerAdminOrOwner = isOwner || isAdmin;

    const messages = await Message.find({ channel: channelId })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('sender', '_id username displayName avatar');

    const formatted = messages.map((msg) => formatMessage(msg, req.user._id, isServerAdminOrOwner));

    res.status(200).json({ success: true, messages: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get messages for a direct conversation
 * GET /api/messages/conversation/:conversationId
 */
export const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'You are not a participant in this conversation' });
    }

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('sender', '_id username displayName avatar');

    // No server-level admins for DMs
    const formatted = messages.map((msg) => formatMessage(msg, req.user._id, false));

    res.status(200).json({ success: true, messages: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Toggle pinned state of a message
 * PUT /api/messages/pin/:messageId
 */
export const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Access control
    if (message.server) {
      const server = await Server.findById(message.server);
      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }
      const isMember = server.members.some(
        (m) => m.user && m.user.toString() === req.user._id.toString()
      );
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access denied: Not a server member' });
      }
    } else if (message.conversation) {
      const conversation = await Conversation.findById(message.conversation);
      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }
      const isParticipant = conversation.participants.some(
        (p) => p.toString() === req.user._id.toString()
      );
      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Access denied: Not a DM participant' });
      }
    }

    message.isPinned = !message.isPinned;
    await message.save();
    await message.populate('sender', '_id username displayName avatar');

    // Broadcast updated message to room
    const io = req.app.get('io');
    if (io) {
      const room = message.channel ? `channel_${message.channel}` : `conversation_${message.conversation}`;
      await broadcastMessageUpdateToRoom(io, room, message, !!message.server, message.server);
    }

    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Edit message content
 * PUT /api/messages/edit/:messageId
 */
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Only sender can edit
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'You are not authorized to edit this message' });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();
    await message.populate('sender', '_id username displayName avatar');

    // Broadcast updated message
    const io = req.app.get('io');
    if (io) {
      const room = message.channel ? `channel_${message.channel}` : `conversation_${message.conversation}`;
      await broadcastMessageUpdateToRoom(io, room, message, !!message.server, message.server);
    }

    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete message
 * DELETE /api/messages/:messageId
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    const isSender = message.sender.toString() === req.user._id.toString();
    let isServerAdminOrOwner = false;

    if (message.server) {
      const server = await Server.findById(message.server);
      if (server) {
        const isOwner = server.owner.toString() === req.user._id.toString();
        const isAdmin = server.admins.some((a) => a.toString() === req.user._id.toString());
        isServerAdminOrOwner = isOwner || isAdmin;
      }
    }

    if (!isSender && !isServerAdminOrOwner) {
      return res.status(403).json({ success: false, error: 'You are not authorized to delete this message' });
    }

    await Message.findByIdAndDelete(messageId);

    // Broadcast message deletion to room
    const io = req.app.get('io');
    if (io) {
      const room = message.channel ? `channel_${message.channel}` : `conversation_${message.conversation}`;
      io.to(room).emit('message_deleted', { messageId });
    }

    res.status(200).json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Scoped search across messages inside channel or direct message scope
 * GET /api/messages/search
 */
export const searchMessages = async (req, res) => {
  try {
    const { query, channelId, conversationId } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter is required' });
    }

    if ((channelId && conversationId) || (!channelId && !conversationId)) {
      return res.status(400).json({ success: false, error: 'You must specify exactly one scope: either channelId or conversationId' });
    }

    let isServerAdminOrOwner = false;
    let searchFilter = {};

    if (channelId) {
      const server = await Server.findOne({ 'categories.channels._id': channelId });
      if (!server) {
        return res.status(404).json({ success: false, error: 'Channel or server not found' });
      }

      const isMember = server.members.some(
        (m) => m.user && m.user.toString() === req.user._id.toString()
      );
      if (!isMember) {
        return res.status(403).json({ success: false, error: 'Access Denied: You are not authorized to view messages in this scope.' });
      }

      const isOwner = server.owner.toString() === req.user._id.toString();
      const isAdmin = server.admins.some((a) => a.toString() === req.user._id.toString());
      isServerAdminOrOwner = isOwner || isAdmin;

      searchFilter = { channel: channelId };
    } else if (conversationId) {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found' });
      }

      const isParticipant = conversation.participants.some(
        (p) => p.toString() === req.user._id.toString()
      );
      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Access Denied: You are not authorized to view messages in this scope.' });
      }

      searchFilter = { conversation: conversationId };
    }

    // Perform text index search
    const results = await Message.find(
      {
        ...searchFilter,
        $text: { $search: query }
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(50)
      .populate('sender', '_id username displayName avatar');

    const formatted = results.map((msg) => formatMessage(msg, req.user._id, isServerAdminOrOwner));

    res.status(200).json({ success: true, messages: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all conversations for the current user
 * GET /api/messages/conversations
 */
export const getUserConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    }).populate('participants', '_id username displayName avatar systemStatus userStatusPreference');

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get or create a direct 1-to-1 conversation with another user
 * POST /api/messages/conversations
 */
export const getOrCreateConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'recipientId is required' });
    }

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot start a conversation with yourself' });
    }

    // Check if conversation already exists between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId]
      });
      await conversation.save();
    }

    // Populate participants
    await conversation.populate('participants', '_id username displayName avatar systemStatus userStatusPreference');

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
