import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  }
}, { _id: false });

const anonymousReactorSchema = new mongoose.Schema({
  anonymousName: {
    type: String,
    required: true
  },
  realUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const reactionSchema = new mongoose.Schema({
  emoji: {
    type: String,
    required: true
  },
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  anonymousReactors: [anonymousReactorSchema]
}, { _id: false });

const messageSchema = new mongoose.Schema({
  server: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server'
  },
  channel: {
    type: mongoose.Schema.Types.ObjectId // References nested channel _id inside Server
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  attachments: [attachmentSchema],
  isAnonymous: {
    type: Boolean,
    default: false
  },
  anonymousSenderName: {
    type: String,
    trim: true
  },
  reactions: [reactionSchema]
}, {
  timestamps: true
});

// Text index on content to support full-text search
messageSchema.index({ content: 'text' });

// Compound indexes for rapid lookups and filters
messageSchema.index({ server: 1, channel: 1 });
messageSchema.index({ conversation: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
