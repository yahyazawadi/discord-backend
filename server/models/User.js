import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const anonymousNameSchema = new mongoose.Schema({
  contextId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  anonymousName: {
    type: String,
    required: true
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    trim: true,
    default: function () {
      return this.username;
    }
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: function () {
      return `https://api.dicebear.com/7.x/initials/svg?seed=${this.username}`;
    }
  },
  systemStatus: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline',
  },
  userStatusPreference: {
    type: String,
    enum: ['auto', 'online', 'idle', 'dnd', 'offline'],
    default: 'auto',
  },
  birthdate: {
    type: Date,
    required: true,
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  anonymousNames: [anonymousNameSchema]
}, {
  timestamps: true
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
