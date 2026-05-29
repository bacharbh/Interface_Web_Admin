import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import User from '../models/User.js';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

const router = express.Router();

// Maps to track failures for progressive delay
const failedAttempts = new Map();

const getDelay = (ip) => {
  const count = failedAttempts.get(ip) || 0;
  if (count === 0) return 0;
  return Math.pow(2, count - 1) * 1000; // 1s, 2s, 4s, 8s...
};

const handleFailure = (req, email) => {
  const count = (failedAttempts.get(req.ip) || 0) + 1;
  failedAttempts.set(req.ip, count);
  console.warn(`[Suspicious Activity] IP: ${req.ip} | Time: ${new Date().toISOString()} | Email tried: ${email}`);
};

const handleSuccess = (req) => {
  failedAttempts.delete(req.ip);
};

const progressiveDelayMiddleware = async (req, res, next) => {
  const delay = getDelay(req.ip);
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  next();
};

// 1. Login Rate Limiter (max 5 / 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Only count failed logins
  message: { error: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Register Rate Limiter (max 3 / 1 hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Limite de création de compte atteinte pour cette IP (max 3/heure).' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'operator', 'viewer').default('viewer')
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');

const buildDevUser = () => ({
  id: 'dev-user',
  username: 'admin',
  email: 'admin@smart-shepherd.local',
  role: 'admin'
});

const buildDevToken = () => jwt.sign(
  { userId: 'dev-user', username: 'admin', role: 'admin' },
  JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || '24h' }
);

// Register new user
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login user
router.post('/login', progressiveDelayMiddleware, loginLimiter, async (req, res) => {
  const loginField = req.body.username || req.body.email || 'unknown';

  try {
    const { username, email, password } = req.body;

    const { error } = loginSchema.validate({ username: loginField, password });
    if (error) {
      handleFailure(req, loginField);
      return res.status(400).json({ error: error.details[0].message });
    }

    if (process.env.NODE_ENV !== 'production' && loginField === 'admin' && password === 'admin123') {
      handleSuccess(req);
      return res.json({
        message: 'Login successful',
        token: buildDevToken(),
        user: buildDevUser()
      });
    }

    if (mongoose.connection.readyState !== 1 && process.env.NODE_ENV !== 'production') {
      const isDevCredentials = loginField === 'admin' && password === 'admin123';
      if (isDevCredentials) {
        handleSuccess(req);
        return res.json({
          message: 'Login successful',
          token: buildDevToken(),
          user: buildDevUser()
        });
      }
    }

    const user = await User.findOne({
      $or: [{ username: loginField }, { email: loginField }]
    });

    if (!user) {
      handleFailure(req, loginField);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      handleFailure(req, loginField);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    handleSuccess(req); // Reset the progressive delay on success

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    handleFailure(req, loginField);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (process.env.NODE_ENV !== 'production' && decoded.username === 'admin') {
      return res.json({ user: buildDevUser() });
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Admin endpoint to manually unlock an IP
router.post('/unlock/:ip', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);

    // Authorization check
    if (decoded.role !== 'admin' && decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
    }

    const targetIp = req.params.ip;

    // Clear progressive delay count
    failedAttempts.delete(targetIp);

    // Clear express-rate-limit internal stores for this IP
    loginLimiter.resetKey(targetIp);
    registerLimiter.resetKey(targetIp);

    res.json({ message: `L'adresse IP ${targetIp} a été débloquée avec succès.` });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token or server error' });
  }
});

export default router;
