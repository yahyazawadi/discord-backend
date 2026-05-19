import express from 'express';
import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  getMe,
  getUsers,
  logoutUser,
  updateStatusPreference,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.get('/users', protect, getUsers);

// Status and block actions
router.put('/status-preference', protect, updateStatusPreference);
router.post('/block/:userId', protect, blockUser);
router.post('/unblock/:userId', protect, unblockUser);
router.get('/blocked', protect, getBlockedUsers);

export default router;

