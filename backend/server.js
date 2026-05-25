import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import winston from 'winston';
import Sheep from './models/Sheep.js';

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
import reportsRoutes from './routes/reports.js';
import agendaRoutes from './routes/agenda.js';

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

// Init Redis
initRedis();

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

// Database connection with enhanced error handling
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-shepherd', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => {
    logger.error('MongoDB connection error:', err);
    logger.warn('Continuing without MongoDB. Development auth fallbacks remain available, but data-backed routes may be limited.');
  });

// Make services available to routes
app.set('io', io);

// Temporary error handlers
const mqttErrorHandler = { getStatus: () => ({ isConnected: false }) };
const wsErrorHandler = { getStatus: () => ({ connectedClients: 0 }) };

// API routes with error monitoring & CACHING
app.use('/api/auth', authRoutes);

const serializeSheep = (sheep) => {
  const plain = typeof sheep?.toObject === 'function' ? sheep.toObject() : sheep;
  const coordinates = Array.isArray(plain?.location?.coordinates) ? plain.location.coordinates : [];
  const lat = typeof plain?.lat === 'number' ? plain.lat : coordinates[1];
  const lng = typeof plain?.lng === 'number' ? plain.lng : coordinates[0];

  return {
    ...plain,
    collar_id: plain.collar_id || plain.collarId || plain.sheepId,
    name: plain.name || plain.sheepId,
    breed: plain.breed || plain.race || 'Other',
    health: plain.health || plain.status || (plain.healthStatus === 'healthy' ? 'good' : plain.healthStatus === 'under_observation' ? 'warning' : 'critical'),
    status: plain.status || plain.healthStatus || 'healthy',
    battery: typeof plain.battery === 'number' ? plain.battery : 100,
    temperature: typeof plain.temperature === 'number' ? plain.temperature : 38,
    lat,
    lng,
    lastUpdate: plain.lastUpdate || plain.lastSeen || plain.updatedAt || plain.createdAt || new Date().toISOString(),
    active: typeof plain.active === 'boolean' ? plain.active : plain.isActive,
  };
};

app.get('/api/animals', async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.breed) filter.breed = req.query.breed;
    if (req.query.gender) filter.gender = req.query.gender;

    const animals = await Sheep.find(filter).sort({ lastSeen: -1 });
    return res.json(animals.map(serializeSheep));
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
app.use('/api/reports', reportsRoutes);
app.use('/api/agenda', agendaRoutes);

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

    const usersRouter = await load('./src/routes/users.js');
    const animalsRouter = await load('./src/routes/animals.js');
    const aiRouter = await load('./src/routes/ai.js');
    const notesRouter = await load('./src/routes/notes.js');

    if (usersRouter) app.use('/api/users', usersRouter);
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
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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

// 404 handler with custom error - temporarily disabled
// app.use('*', notFound);

// Global error handler (must be last) - temporarily disabled
// app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);

  // Initialize MQTT service
  initializeMQTT(io);

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
