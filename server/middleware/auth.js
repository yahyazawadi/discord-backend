import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware to protect routes. Requires a valid JWT in Authorization header or cookie.
 */
export const protect = async (req, res, next) => {
  let token;

  // Check Authorization header (Bearer <token>)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check cookies
  else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      if (key && val) acc[key] = val;
      return acc;
    }, {});
    if (cookies.token) {
      token = cookies.token;
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, no token provided',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized, user not found',
      });
    }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, token verification failed',
    });
  }
};

/**
 * Optional middleware to decode JWT if present, without blocking unauthenticated requests.
 */
export const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } 
  // Check cookies
  else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
      const [key, val] = c.trim().split('=');
      if (key && val) acc[key] = val;
      return acc;
    }, {});
    if (cookies.token) {
      token = cookies.token;
    }
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
