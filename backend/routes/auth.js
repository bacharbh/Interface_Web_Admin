import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const router = express.Router();

const failedAttempts = new Map();

const getDelay = (ip) => {
  const count = failedAttempts.get(ip) || 0;
  if (count === 0) return 0;
  return Math.pow(2, count - 1) * 1000;
};

const handleFailure = (req, email) => {
  const count = (failedAttempts.get(req.ip) || 0) + 1;
  failedAttempts.set(req.ip, count);
  console.warn(`[Auth] Echec connexion — IP: ${req.ip} | identifiant: ${email}`);
};

const handleSuccess = (req) => failedAttempts.delete(req.ip);

const progressiveDelayMiddleware = async (req, _res, next) => {
  const delay = getDelay(req.ip);
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  next();
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Limite de création de compte atteinte (max 3/heure).' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required.');

// Utilisateurs en mémoire (remplace MongoDB User model)
// Pour ajouter des utilisateurs permanents, modifiez cette liste
const USERS = [
  {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@smart-shepherd.local',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
    role: 'admin',
  }
];

const buildToken = (user) =>
  jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );

const buildUserResponse = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
});

// POST /api/auth/register — crée un utilisateur en mémoire (session courante)
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email et password sont requis' });
    }
    if (USERS.find(u => u.username === username || u.email === email)) {
      return res.status(400).json({ error: 'Utilisateur déjà existant' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = { id: `user-${Date.now()}`, username, email, password: hashed, role };
    USERS.push(user);
    res.status(201).json({ message: 'Utilisateur créé', token: buildToken(user), user: buildUserResponse(user) });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// POST /api/auth/login
router.post('/login', progressiveDelayMiddleware, loginLimiter, async (req, res) => {
  const loginField = req.body.username || req.body.email || 'unknown';
  try {
    const { error } = loginSchema.validate({ username: loginField, password: req.body.password });
    if (error) {
      handleFailure(req, loginField);
      return res.status(400).json({ error: error.details[0].message });
    }

    const user = USERS.find(u => u.username === loginField || u.email === loginField);
    if (!user) {
      handleFailure(req, loginField);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      handleFailure(req, loginField);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    handleSuccess(req);
    res.json({ message: 'Connexion réussie', token: buildToken(user), user: buildUserResponse(user) });
  } catch {
    handleFailure(req, loginField);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

// GET /api/auth/profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = USERS.find(u => u.id === decoded.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: buildUserResponse(user) });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// POST /api/auth/unlock/:ip
router.post('/unlock/:ip', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token manquant' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin' && decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Accès interdit. Rôle admin requis.' });
    }
    const targetIp = req.params.ip;
    failedAttempts.delete(targetIp);
    loginLimiter.resetKey(targetIp);
    registerLimiter.resetKey(targetIp);
    res.json({ message: `IP ${targetIp} débloquée.` });
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

export default router;
