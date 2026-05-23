/**
 * Smart Shepherd - Error Logging and Monitoring System
 * Système complet de logging des erreurs avec métriques et alertes
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname replacement for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration du logger Winston
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  })
);

/**
 * Création du logger principal
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'smart-shepherd-api' },
  transports: [
    // Fichier pour les logs d'erreurs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Fichier pour tous les logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Fichier pour les logs critiques
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/critical.log'),
      level: 'critical',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Ajout de la console en développement
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * Système de monitoring des erreurs
 */
class ErrorMonitor {
  constructor() {
    this.errorCounts = new Map();
    this.errorThresholds = {
      'VALIDATION_ERROR': 100,      // 100 erreurs de validation par heure
      'DATABASE_ERROR': 10,         // 10 erreurs de base de données par heure
      'EXTERNAL_SERVICE_ERROR': 5,  // 5 erreurs de service externe par heure
      'MQTT_CONNECTION_ERROR': 3,   // 3 erreurs MQTT par heure
      'UNAUTHORIZED': 50,           // 50 erreurs d'authentification par heure
    };
    this.alertCooldowns = new Map();
  }

  /**
   * Enregistre une erreur et vérifie les seuils d'alerte
   */
  logError(error, context = {}) {
    const errorKey = error.errorCode || 'UNKNOWN_ERROR';
    const currentHour = new Date().getHours();
    const key = `${errorKey}_${currentHour}`;

    // Incrémenter le compteur
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    // Vérifier si on dépasse le seuil
    const threshold = this.errorThresholds[errorKey] || 20;
    const count = this.errorCounts.get(key);

    if (count >= threshold && !this.alertCooldowns.has(key)) {
      this.triggerAlert(errorKey, count, threshold, context);
      this.alertCooldowns.set(key, Date.now() + 3600000); // 1 heure de cooldown
    }

    // Nettoyer les anciens compteurs
    this.cleanupOldCounters();
  }

  /**
   * Déclenche une alerte
   */
  triggerAlert(errorType, count, threshold, context) {
    const alertMessage = `ALERT: ${count} ${errorType} errors in the last hour (threshold: ${threshold})`;

    logger.critical(alertMessage, {
      errorType,
      count,
      threshold,
      context,
      timestamp: new Date().toISOString()
    });

    // Envoyer une notification (implémenter selon le système de notification)
    this.sendNotification(alertMessage, context);
  }

  /**
   * Envoie une notification d'alerte
   */
  sendNotification(message, context) {
    // Implémenter l'envoi de notification (email, Slack, etc.)
    logger.info('Alert notification sent', { message, context });
  }

  /**
   * Nettoie les anciens compteurs
   */
  cleanupOldCounters() {
    const currentHour = new Date().getHours();
    for (const [key] of this.errorCounts) {
      const hour = parseInt(key.split('_')[1]);
      if (hour !== currentHour) {
        this.errorCounts.delete(key);
      }
    }
  }

  /**
   * Obtient les statistiques d'erreurs
   */
  getErrorStats() {
    const stats = {};
    for (const [key, count] of this.errorCounts) {
      const [errorType, hour] = key.split('_');
      if (!stats[errorType]) {
        stats[errorType] = { hourly: {}, total: 0 };
      }
      stats[errorType].hourly[hour] = count;
      stats[errorType].total += count;
    }
    return stats;
  }
}

/**
 * Instance du monitor d'erreurs
 */
const errorMonitor = new ErrorMonitor();

/**
 * Middleware pour intercepter et logger les erreurs
 */
const errorLoggerMiddleware = (err, req, res, next) => {
  // Enregistrer l'erreur dans le monitor
  errorMonitor.logError(err, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Logger avec Winston
  const logLevel = err.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  next(err);
};

/**
 * Logger spécialisé pour les erreurs MQTT
 */
const mqttLogger = {
  connectionError: (broker, error) => {
    logger.error('MQTT Connection Error', {
      broker,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },

  messageError: (topic, message, error) => {
    logger.error('MQTT Message Error', {
      topic,
      message: message.toString(),
      error: error.message,
      timestamp: new Date().toISOString()
    });
  },

  reconnectionAttempt: (broker, attempt) => {
    logger.info('MQTT Reconnection Attempt', {
      broker,
      attempt,
      timestamp: new Date().toISOString()
    });
  },

  reconnectionSuccess: (broker) => {
    logger.info('MQTT Reconnection Success', {
      broker,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Logger spécialisé pour les erreurs WebSocket
 */
const websocketLogger = {
  connectionError: (socketId, error) => {
    logger.error('WebSocket Connection Error', {
      socketId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },

  messageError: (socketId, event, error) => {
    logger.error('WebSocket Message Error', {
      socketId,
      event,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  },

  timeoutError: (socketId, timeout) => {
    logger.warn('WebSocket Timeout', {
      socketId,
      timeout,
      timestamp: new Date().toISOString()
    });
  },

  disconnect: (socketId, reason) => {
    logger.info('WebSocket Disconnect', {
      socketId,
      reason,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Logger spécialisé pour les erreurs de base de données
 */
const databaseLogger = {
  connectionError: (error) => {
    logger.critical('Database Connection Error', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },

  queryError: (query, error) => {
    logger.error('Database Query Error', {
      query: query.substring(0, 200), // Limiter la taille du log
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  },

  validationError: (model, errors) => {
    logger.warn('Database Validation Error', {
      model,
      errors,
      timestamp: new Date().toISOString()
    });
  },

  duplicateKeyError: (collection, key, value) => {
    logger.warn('Database Duplicate Key Error', {
      collection,
      key,
      value,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Dashboard de monitoring des erreurs
 */
const getErrorDashboard = () => {
  return {
    stats: errorMonitor.getErrorStats(),
    recentErrors: getRecentErrors(),
    errorTrends: getErrorTrends(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
};

/**
 * Récupère les erreurs récentes depuis les logs
 */
const getRecentErrors = () => {
  // Implémenter la lecture des logs récents
  // Pour l'instant, retourner des données de test
  return [];
};

/**
 * Calcule les tendances d'erreurs
 */
const getErrorTrends = () => {
  // Implémenter le calcul des tendances
  // Pour l'instant, retourner des données de test
  return {};
};

export {
  logger,
  errorMonitor,
  errorLoggerMiddleware,
  mqttLogger,
  websocketLogger,
  databaseLogger,
  getErrorDashboard
};
