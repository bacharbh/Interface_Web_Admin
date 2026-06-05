/**
 * Smart Shepherd - Global Error Handler Middleware
 * Gestion unifiée des erreurs Express avec format JSON standardisé
 */

import AppError from '../utils/AppError.js';
import { logger } from '../utils/errorLogger.js';

/**
 * Gestionnaire d'erreurs principal pour Express
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log l'erreur complète en développement
  logger.error('Error occurred:', {
    error: err,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Gestion des erreurs Mongoose
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // Gestion des champs dupliqués Mongoose
  if (err.code === 11000) {
    error = handleDuplicateFieldsError(err);
  }

  // Gestion des erreurs de validation Mongoose
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // Gestion des erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    error = AppError.unauthorized('Token JWT invalide');
  }

  // Gestion des erreurs JWT expirés
  if (err.name === 'TokenExpiredError') {
    error = AppError.unauthorized('Token JWT expiré');
  }

  // Gestion des erreurs de syntaxe JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = AppError.validation('JSON invalide dans le corps de la requête');
  }

  // Gestion des erreurs de limite de taille
  if (err.type === 'entity.too.large') {
    error = AppError.validation('Corps de requête trop volumineux');
  }

  // Si l'erreur n'est pas opérationnelle, la masquer en production
  if (!error.isOperational && process.env.NODE_ENV === 'production') {
    error = AppError.database('Erreur interne du serveur');
  }

  // Envoyer la réponse d'erreur formatée
  res.status(error.statusCode || 500).json(error.toJSON());
};

/**
 * Gestion des erreurs de conversion Mongoose (CastError)
 */
const handleCastError = (err) => {
  const message = `Valeur invalide '${err.value}' pour le champ ${err.path}`;
  return AppError.validation(message, {
    field: err.path,
    value: err.value,
    expectedType: err.kind
  });
};

/**
 * Gestion des champs dupliqués Mongoose (code 11000)
 */
const handleDuplicateFieldsError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  
  const messages = {
    email: 'Un utilisateur avec cet email existe déjà',
    username: 'Ce nom d\'utilisateur est déjà pris',
    sheepId: 'Cet identifiant d\'animal existe déjà',
    deviceId: 'Ce dispositif est déjà enregistré'
  };

  const defaultMessage = `Un enregistrement avec ce ${field} existe déjà`;
  const message = messages[field] || defaultMessage;

  return AppError.conflict(message, {
    field,
    value,
    duplicate: true
  });
};

/**
 * Gestion des erreurs de validation Mongoose
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(val => ({
    field: val.path,
    message: val.message,
    value: val.value
  }));

  const message = 'Validation échouée';
  return AppError.validation(message, errors);
};

/**
 * Gestionnaire d'erreurs asynchrones (async/await)
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware pour les routes non trouvées (404)
 */
const notFound = (req, res, next) => {
  const error = AppError.notFound(`Route ${req.originalUrl}`);
  next(error);
};

/**
 * Gestionnaire d'erreurs pour les requêtes asynchrones non capturées
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
    process.exit(1);
  });
};

/**
 * Gestionnaire d'exceptions non gérées (rejets de promesses)
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', err);
    process.exit(1);
  });
};

/**
 * Validation des erreurs personnalisées
 */
const validateError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  // Erreurs Mongoose
  if (error.name === 'CastError') {
    return handleCastError(error);
  }

  if (error.code === 11000) {
    return handleDuplicateFieldsError(error);
  }

  if (error.name === 'ValidationError') {
    return handleValidationError(error);
  }

  // Erreurs JWT
  if (error.name === 'JsonWebTokenError') {
    return AppError.unauthorized('Token JWT invalide');
  }

  if (error.name === 'TokenExpiredError') {
    return AppError.unauthorized('Token JWT expiré');
  }

  // Erreur générique
  return new AppError(
    error.message || 'Erreur interne du serveur',
    error.statusCode || 500,
    error.errorCode || 'INTERNAL_SERVER_ERROR'
  );
};

/**
 * Middleware de monitoring des erreurs
 */
const errorMonitor = (err, req, res, next) => {
  // Envoi d'alertes pour les erreurs critiques
  if (err.statusCode >= 500) {
    logger.critical('Critical error detected', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  next(err);
};

export {
  errorHandler,
  catchAsync,
  notFound,
  validateError,
  errorMonitor,
  handleUncaughtException,
  handleUnhandledRejection
};
