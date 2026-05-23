/**
 * Smart Shepherd - Enhanced Authentication Middleware
 * Gestion du refresh token et validation automatique
 */

import jwtService from '../utils/jwtService.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { catchAsync } from './errorHandler.js';

/**
 * Middleware d'authentification principal
 */
const authenticate = catchAsync(async (req, res, next) => {
  // Dev bypass to keep local dashboard APIs functional without JWT setup.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH !== 'false') {
    if (!req.path.includes('/health')) {
      console.warn(`🔓 Auth Bypass active for ${req.method} ${req.path}`);
    }
    req.user = { id: 'dev-local', role: 'admin', isActive: true };
    req.token = { sub: 'dev-local', iat: Math.floor(Date.now() / 1000) };
    req.permissions = ['*'];
    return next();
  }

  // 1. Essayer de vérifier l'access token
  let user = null;
  let tokenRefreshed = false;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      // Vérifier l'access token
      const decoded = await jwtService.verifyAccessToken(token);
      user = await User.findById(decoded.sub);

      if (!user || !user.isActive) {
        throw new Error('Utilisateur invalide');
      }

      // Ajouter les informations utilisateur à la requête
      req.user = user;
      req.token = decoded;

    } catch (error) {
      // L'access token est invalide, essayer le refresh token
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        try {
          const decoded = await jwtService.verifyRefreshToken(refreshToken);
          user = await User.findById(decoded.sub);

          if (!user || !user.isActive) {
            throw new Error('Utilisateur invalide');
          }

          // Générer un nouvel access token
          const newAccessToken = jwtService.generateAccessToken(
            jwtService.createTokenPayload(user)
          );

          // Stocker le nouveau token
          const newDecoded = jwtService.decodeToken(newAccessToken);
          await jwtService.storeUserTokens(user.id, newDecoded.payload.jti, 'access');

          // Ajouter le nouveau token au header de réponse
          res.setHeader('X-New-Access-Token', newAccessToken);
          res.setHeader('X-Token-Refreshed', 'true');

          req.user = user;
          req.token = newDecoded.payload;
          tokenRefreshed = true;

        } catch (refreshError) {
          // Le refresh token est aussi invalide
          throw AppError.unauthorized('Session expirée, veuillez vous reconnecter');
        }
      } else {
        throw AppError.unauthorized('Token d\'authentification manquant');
      }
    }
  } else {
    // Pas de token dans le header, essayer le refresh token
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const decoded = await jwtService.verifyRefreshToken(refreshToken);
        user = await User.findById(decoded.sub);

        if (!user || !user.isActive) {
          throw new Error('Utilisateur invalide');
        }

        // Générer un nouvel access token
        const newAccessToken = jwtService.generateAccessToken(
          jwtService.createTokenPayload(user)
        );

        // Stocker le nouveau token
        const newDecoded = jwtService.decodeToken(newAccessToken);
        await jwtService.storeUserTokens(user.id, newDecoded.payload.jti, 'access');

        // Ajouter le nouveau token au header de réponse
        res.setHeader('X-New-Access-Token', newAccessToken);
        res.setHeader('X-Token-Refreshed', 'true');

        req.user = user;
        req.token = newDecoded.payload;
        tokenRefreshed = true;

      } catch (refreshError) {
        throw AppError.unauthorized('Token d\'authentification manquant');
      }
    } else {
      throw AppError.unauthorized('Token d\'authentification manquant');
    }
  }

  // Vérifier si le mot de passe a été changé après l'émission du token
  if (req.token.iat && user.passwordChangedAt) {
    const tokenIssuedAt = new Date(req.token.iat * 1000);
    const passwordChangedAt = new Date(user.passwordChangedAt);

    if (tokenIssuedAt < passwordChangedAt) {
      throw AppError.unauthorized('Token invalide: mot de passe modifié');
    }
  }

  // Ajouter les permissions à la requête
  req.permissions = jwtService.getUserPermissions(user);

  next();
});

/**
 * Middleware pour vérifier les permissions
 */
const authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentification requise'));
    }

    if (permissions.length === 0) {
      return next(); // Aucune permission requise
    }

    const userPermissions = req.permissions || [];
    const hasAllPermissions = permissions.every(permission =>
      userPermissions.includes(permission) || userPermissions.includes('*')
    );

    if (!hasAllPermissions) {
      return next(AppError.forbidden('Permissions insuffisantes'));
    }

    next();
  };
};

/**
 * Middleware pour vérifier les rôles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentification requise'));
    }

    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Rôle non autorisé'));
    }

    next();
  };
};

/**
 * Middleware optionnel (ne bloque pas si non authentifié)
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const decoded = await jwtService.verifyAccessToken(token);
      const user = await User.findById(decoded.sub);

      if (user && user.isActive) {
        req.user = user;
        req.token = decoded;
        req.permissions = jwtService.getUserPermissions(user);
      }
    } catch (error) {
      // Ignorer les erreurs pour l'auth optionnelle
    }
  }

  next();
});

/**
 * Middleware pour vérifier si l'utilisateur est propriétaire de la ressource
 */
const requireOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentification requise'));
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // Les administrateurs peuvent accéder à toutes les ressources
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Vérifier si l'utilisateur est propriétaire
    if (resourceId !== userId) {
      return next(AppError.forbidden('Accès non autorisé à cette ressource'));
    }

    next();
  };
};

/**
 * Middleware pour limiter le taux de requêtes par utilisateur
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Nettoyer les anciennes requêtes
    if (requests.has(userId)) {
      requests.set(userId, requests.get(userId).filter(timestamp => timestamp > windowStart));
    }

    // Ajouter la requête actuelle
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    requests.get(userId).push(now);

    // Vérifier la limite
    if (requests.get(userId).length > maxRequests) {
      return next(AppError.tooManyRequests('Trop de requêtes'));
    }

    next();
  };
};

/**
 * Middleware pour vérifier la validité de la session
 */
const validateSession = catchAsync(async (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized('Authentification requise'));
  }

  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    try {
      const decoded = jwtService.decodeToken(refreshToken);
      if (decoded && decoded.payload) {
        const isBlacklisted = await jwtService.isTokenBlacklisted(decoded.payload.jti);
        if (isBlacklisted) {
          throw new Error('Session révoquée');
        }
      }
    } catch (error) {
      throw AppError.unauthorized('Session invalide');
    }
  }

  next();
});

export {
  authenticate,
  authorize,
  requireRole,
  optionalAuth,
  requireOwnership,
  rateLimitByUser,
  validateSession
};
