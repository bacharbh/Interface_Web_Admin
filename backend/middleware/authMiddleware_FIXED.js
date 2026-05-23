import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

// Rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting for general API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT with additional security checks
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      clockTolerance: 30 // 30 seconds tolerance
    });

    // Check if token is blacklisted (implement token blacklist for logout)
    const isBlacklisted = await checkTokenBlacklist(token);
    if (isBlacklisted) {
      return res.status(401).json({ 
        error: 'Token has been revoked.',
        code: 'TOKEN_REVOKED'
      });
    }

    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        error: 'Invalid token or user not found.',
        code: 'INVALID_USER'
      });
    }

    // Check if user session is still valid (optional session timeout)
    if (decoded.iat && user.lastLogin) {
      const sessionAge = (Date.now() / 1000) - decoded.iat;
      const maxSessionAge = 24 * 60 * 60; // 24 hours
      
      if (sessionAge > maxSessionAge) {
        return res.status(401).json({ 
          error: 'Session expired.',
          code: 'SESSION_EXPIRED'
        });
      }
    }

    // Add user and token to request
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Log security issues
    console.error('Auth middleware error:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: 'Authentication error.',
      code: 'AUTH_ERROR'
    });
  }
};

// Check if token is blacklisted (Redis implementation recommended)
const checkTokenBlacklist = async (token) => {
  // For now, return false (implement with Redis in production)
  // await redis.get(`blacklist:${token}`)
  return false;
};

// Enhanced role-based access control
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Access denied. User not authenticated.',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      console.warn('Unauthorized access attempt:', {
        userId: req.user._id,
        role: req.user.role,
        requiredRoles: roles,
        ip: req.ip,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Resource owner check (users can only access their own resources)
export const checkResourceOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    const resourceId = req.params[resourceIdParam];
    const userId = req.user._id.toString();
    
    // Admins can access all resources
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    // Check if user owns the resource
    if (resourceId !== userId) {
      return res.status(403).json({ 
        error: 'Access denied. Resource ownership required.',
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }
    
    next();
  };
};

export default authMiddleware;
