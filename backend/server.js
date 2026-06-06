import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import winston from 'winston';
import { getAllAnimals, getFirestoreStats } from './services/firebaseService.js';

// Import cache system
import { initRedis, cacheMiddleware, clearCacheMiddleware } from './middleware/cache.js';

// Import routes
import authRoutes from './routes/auth.js';
import sheepRoutes from './routes/sheep.js';
import telemetryRoutes from './routes/telemetry.js';
import geofenceRoutes from './routes/geofence.js';
import notificationRoutes from './routes/notifications.js';
import alertsRoutes from './routes/alerts.js';
import historyRoutes from './routes/history.js';
import weatherRoutes from './routes/weather.js';
import aiPredictionRoutes from './routes/aiPrediction.js';
import aiAnalysisRoutes from './routes/ai.js';
import anomalyRoutes from './routes/anomalies.js';
import reportsRoutes from './routes/reports.js';
import agendaRoutes from './routes/agenda.js';
import labellingRoutes from './routes/labelling.js';
import settingsRoutes from './routes/settings.js';
import authMiddleware from './middleware/auth.js';
import usersRoutes from './src/routes/users.js';

import aiService from './services/aiHealthPrediction.js';
import { initializeMQTT } from './services/mqttService.js';

// Temporary simple logger
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  critical: console.error
};

// Configure environment variables
dotenv.config();

const REDIS_ENABLED = Boolean(process.env.REDIS_URL) && process.env.REDIS_ENABLED === 'true';
const MQTT_BROKER = process.env.MQTT_BROKER_URL || process.env.MQTT_BROKER;
const MQTT_ENABLED = Boolean(MQTT_BROKER) && MQTT_BROKER !== 'disabled';

// Initialize Express app
const app = express();
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174'
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow Vite dev ports on localhost (e.g. 5173, 5174, 5175...)
  if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    return true;
  }

  return false;
};

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"]
  }
});

// Init Redis only when explicitly enabled
if (REDIS_ENABLED) {
  initRedis();
} else {
  console.warn('[Redis] disabled — set REDIS_ENABLED=true and REDIS_URL to activate');
}

// Configure logging
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'smart-shepherd-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

// Rate limiting
const isDevelopment = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Firebase Realtime Database — vérification au démarrage
const FIREBASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://smartshepherd-4413d-default-rtdb.firebaseio.com';
logger.info(`[Firebase] Using RTDB: ${FIREBASE_URL}`);

// Make services available to routes
app.set('io', io);

// Temporary error handlers
const mqttErrorHandler = { getStatus: () => ({ isConnected: false }) };
const wsErrorHandler = { getStatus: () => ({ connectedClients: 0 }) };

// API routes with error monitoring & CACHING
app.use('/api/auth', authRoutes);


app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getFirestoreStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching Firestore stats' });
  }
});

app.get('/api/animals', async (req, res) => {
  try {
    let animals = await getAllAnimals();
    if (req.query.breed) animals = animals.filter(a => a.breed === req.query.breed);
    if (req.query.gender) animals = animals.filter(a => a.gender === req.query.gender);
    return res.json(animals);
  } catch (error) {
    return res.status(500).json({ error: 'Error fetching animals data' });
  }
});

// Caching with Redis:
app.use('/api/sheep', clearCacheMiddleware('/api/sheep'), cacheMiddleware(30), sheepRoutes);
app.use('/api/telemetry', clearCacheMiddleware('/api/telemetry'), cacheMiddleware(10), telemetryRoutes);
app.use('/api/alerts', clearCacheMiddleware('/api/alerts'), cacheMiddleware(5), alertsRoutes);
app.use('/api/notifications', clearCacheMiddleware('/api/notifications'), cacheMiddleware(5), notificationRoutes);

app.use('/api/geofence', geofenceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/ai', aiPredictionRoutes);
app.use('/api/ai', aiAnalysisRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/labelling', labellingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', authMiddleware, usersRoutes);

// Attempt to load optional TypeScript-based routers if available.
// These routers live under `backend/src/routes` (TypeScript) and may
// not be present at runtime. Load them dynamically and skip on error.
(async () => {
  try {
    const load = async (path) => {
      try {
        const mod = await import(path);
        return mod && (mod.default || mod);
      } catch (_) {
        return null;
      }
    };

    const animalsRouter = await load('./src/routes/animals.js');
    const aiRouter = await load('./src/routes/ai.js');
    const notesRouter = await load('./src/routes/notes.js');

    if (animalsRouter) app.use('/api/animals', animalsRouter);
    if (aiRouter) app.use('/api/ai', aiRouter);
    if (notesRouter) app.use('/api/animals/:id/notes', notesRouter);
  } catch (e) {
    logger.warn('Optional TS routers not loaded:', e && e.message ? e.message : e);
  }
})();

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: `firebase:${FIREBASE_URL}`,
      mqtt: mqttErrorHandler.getStatus(),
      websocket: wsErrorHandler.getStatus(),
      version: process.env.npm_package_version || '1.0.0'
    };
    res.json(health);
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Error dashboard endpoint (admin only) - temporarily disabled
// app.get('/api/errors/dashboard', catchAsync(async (req, res) => {
//   const dashboard = require('./utils/errorLogger').getErrorDashboard();
//   res.json(dashboard);
// }));

// Apply error monitoring middleware before routes - temporarily disabled
// app.use(errorLoggerMiddleware);

// Global error handler — catches errors passed via next(err)
app.use((err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ success: false, error: err.message || 'Internal server error' });
});

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
});

// Start server
const PORT = process.env.PORT || 5000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is already in use. Kill the existing process or set a different PORT in .env`);
  } else {
    console.error('[Server] Fatal error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);

  // Initialize MQTT service
  if (MQTT_ENABLED) {
    initializeMQTT(io);
  } else {
    logger.warn('[MQTT] disabled in this environment');
  }

  // Initialize AI service
  try {
    await aiService.initialize();
    logger.info('AI Health Prediction service initialized');

    // Initialize Daily Briefing Service
    import('./services/briefingService.js');
    logger.info('Daily Briefing service scheduled');

  } catch (error) {
    logger.warn('AI Health Prediction service initialization failed:', error.message);
  }
});

export default app;
