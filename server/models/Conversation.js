import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    validate: [
      (val) => val.length === 2,
      'A conversation must have exactly 2 participants'
    ],
    required: true
  }
}, {
  timestamps: true
});

// Compound index to quickly fetch conversations between two users
conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
