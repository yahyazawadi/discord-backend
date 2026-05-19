import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import sendEmail from '../utils/sendEmail.js';

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register a new user (Creates unverified user and sends OTP)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  const { username, email, password, birthdate } = req.body;

  if (!username || !email || !password || !birthdate) {
    return res.status(400).json({ success: false, error: 'Please provide all required fields', message: 'Please provide all required fields' });
  }

  try {
    // Age Validation (Must be at least 13)
    const birthDateObj = new Date(birthdate);
    const ageDiffMs = Date.now() - birthDateObj.getTime();
    const ageDate = new Date(ageDiffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);

    if (age < 13) {
      return res.status(400).json({ success: false, error: 'You must be at least 13 years old to register.', message: 'You must be at least 13 years old to register.' });
    }

    // Check if user already exists and is verified
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      if (existingEmail.isVerified) {
        return res.status(400).json({ success: false, error: 'Email already registered', message: 'Email already registered' });
      } else {
        // Delete pending unverified user to avoid duplicate key issues
        await User.deleteOne({ _id: existingEmail._id });
      }
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      if (existingUsername.isVerified) {
        return res.status(400).json({ success: false, error: 'Username already taken', message: 'Username already taken' });
      } else {
        // Delete pending unverified user
        await User.deleteOne({ _id: existingUsername._id });
      }
    }

    // Create the unverified user
    const user = await User.create({
      username,
      email,
      password,
      birthdate,
      isVerified: false,
    });

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set TTL to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to database (hashed automatically on pre-save)
    await Otp.create({
      email,
      otp: otpCode,
      expiresAt,
    });

    // Send verification email
    await sendEmail({
      email: user.email,
      subject: 'Verify Your Discord Clone Account',
      text: `Welcome to Discord Clone! Your verification code is: ${otpCode}. It will expire in 10 minutes.`,
      html: `<h3>Welcome to Discord Clone!</h3><p>Your verification code is: <strong>${otpCode}</strong></p><p>This code will expire in 10 minutes.</p>`,
    });

    res.status(201).json({
      success: true,
      message: 'OTP sent to email. Please verify to complete registration.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and activate user account
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Please provide email and verification code' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: 'User registration not found or expired' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'User is already verified' });
    }

    // Find the latest OTP record for this email
    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'Verification code expired or invalid' });
    }

    // Verify OTP code
    const isMatch = await otpRecord.matchOtp(otp);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    // Activate the user
    user.isVerified = true;
    await user.save();

    // Clean up all OTPs for this email
    await Otp.deleteMany({ email });

    const token = generateToken(user._id);

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Lax is better for dev local loops
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        systemStatus: user.systemStatus,
        userStatusPreference: user.userStatusPreference,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend OTP verification code
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
export const resendOtp = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Please provide your email address' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, error: 'User registration not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'User is already verified' });
    }

    // Delete any old OTP codes
    await Otp.deleteMany({ email });

    // Generate new code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await Otp.create({
      email,
      otp: otpCode,
      expiresAt,
    });

    await sendEmail({
      email: user.email,
      subject: 'Your New Discord Clone Verification Code',
      text: `Your new verification code is: ${otpCode}. It will expire in 10 minutes.`,
      html: `<p>Your new verification code is: <strong>${otpCode}</strong></p><p>This code will expire in 10 minutes.</p>`,
    });

    res.status(200).json({
      success: true,
      message: 'New verification OTP sent to email.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user and get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ success: false, error: 'Please verify your email before logging in.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    const token = generateToken(user._id);

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Lax is better for dev local loops
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatar: user.avatar,
        systemStatus: user.systemStatus,
        userStatusPreference: user.userStatusPreference,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all other verified users to start DMs
 * @route   GET /api/auth/users
 * @access  Private
 */
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find(
      { isVerified: true, _id: { $ne: req.user._id } },
      'username displayName avatar systemStatus userStatusPreference'
    );
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user (Clears cookie)
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logoutUser = async (req, res, next) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
    });
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update status preference
 * @route   PUT /api/auth/status-preference
 * @access  Private
 */
export const updateStatusPreference = async (req, res, next) => {
  const { preference } = req.body;
  const validPreferences = ['auto', 'online', 'idle', 'dnd', 'offline'];

  if (!preference || !validPreferences.includes(preference)) {
    return res.status(400).json({ success: false, error: 'Invalid status preference' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.userStatusPreference = preference;
    await user.save();

    // Broadcast presence update via Socket.io
    const io = req.app.get('io');
    if (io) {
      const resolvedStatus = preference === 'auto'
        ? (user.systemStatus || 'offline')
        : preference;

      // Find all mutual servers
      const Server = (await import('../models/Server.js')).default;
      const Conversation = (await import('../models/Conversation.js')).default;
      
      const servers = await Server.find({ 'members.user': user._id });
      servers.forEach(srv => {
        io.to(`server_${srv._id}`).emit('presence_update', {
          userId: user._id,
          status: resolvedStatus
        });
      });

      // Find all active conversations
      const conversations = await Conversation.find({ participants: user._id });
      conversations.forEach(conv => {
        io.to(`conversation_${conv._id}`).emit('presence_update', {
          userId: user._id,
          status: resolvedStatus
        });
      });
    }

    res.status(200).json({
      success: true,
      userStatusPreference: user.userStatusPreference
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Block a user
 * @route   POST /api/auth/block/:userId
 * @access  Private
 */
export const blockUser = async (req, res, next) => {
  const { userId } = req.params;

  if (userId === req.user._id.toString()) {
    return res.status(400).json({ success: false, error: 'You cannot block yourself' });
  }

  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User to block not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user.blockedUsers.includes(userId)) {
      user.blockedUsers.push(userId);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'User blocked successfully', blockedUsers: user.blockedUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unblock a user
 * @route   POST /api/auth/unblock/:userId
 * @access  Private
 */
export const unblockUser = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userId);
    await user.save();

    res.status(200).json({ success: true, message: 'User unblocked successfully', blockedUsers: user.blockedUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get blocked users list
 * @route   GET /api/auth/blocked
 * @access  Private
 */
export const getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('blockedUsers', '_id username displayName avatar');
    res.status(200).json({ success: true, blockedUsers: user.blockedUsers });
  } catch (error) {
    next(error);
  }
};

