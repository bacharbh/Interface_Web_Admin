/**
 * Smart Shepherd - Refresh Token Endpoint
 * Endpoint /auth/refresh avec rotation des tokens
 */

const express = require('express');
const jwtService = require('../utils/jwtService');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * POST /auth/refresh
 * Rafraîchit le access token en utilisant le refresh token
 */
router.post('/refresh', catchAsync(async (req, res) => {
  // Récupérer le refresh token depuis le cookie httpOnly
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token manquant');
  }

  try {
    // Vérifier le refresh token
    const decoded = await jwtService.verifyRefreshToken(refreshToken);
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Utilisateur invalide');
    }

    // Vérifier que l'utilisateur n'a pas changé de rôle/mot de passe
    if (decoded.passwordChangedAt && user.passwordChangedAt) {
      const tokenChangedAt = new Date(decoded.passwordChangedAt * 1000);
      const userChangedAt = new Date(user.passwordChangedAt);
      
      if (tokenChangedAt < userChangedAt) {
        throw AppError.unauthorized('Token invalide: mot de passe modifié');
      }
    }

    // Effectuer la rotation du refresh token
    const newTokens = await jwtService.rotateRefreshToken(refreshToken, user);
    
    // Stocker les nouveaux tokens
    const newDecoded = jwtService.decodeToken(newTokens.accessToken);
    await jwtService.storeUserTokens(user.id, newDecoded.payload.jti, 'access');
    await jwtService.storeUserTokens(user.id, newDecoded.payload.jti, 'refresh');

    // Envoyer le nouveau refresh token dans un cookie httpOnly
    const refreshCookie = jwtService.generateRefreshTokenCookie(newTokens.refreshToken);
    res.cookie(refreshCookie.name, refreshCookie.value, refreshCookie.options);

    // Envoyer la réponse avec le nouveau access token
    res.json({
      success: true,
      message: 'Token rafraîchi avec succès',
      data: {
        accessToken: newTokens.accessToken,
        expiresIn: newTokens.expiresIn,
        tokenType: newTokens.tokenType,
        rotated: newTokens.rotated,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: jwtService.getUserPermissions(user)
        }
      }
    });

  } catch (error) {
    // En cas d'erreur, effacer le cookie de refresh token
    const clearCookie = jwtService.generateClearRefreshTokenCookie();
    res.cookie(clearCookie.name, clearCookie.value, clearCookie.options);
    
    throw error;
  }
}));

/**
 * POST /auth/logout
 * Déconnexion et révocation des tokens
 */
router.post('/logout', catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      // Vérifier et blacklister le refresh token
      const decoded = jwtService.decodeToken(refreshToken);
      if (decoded && decoded.payload) {
        await jwtService.blacklistToken(decoded.payload.jti, decoded.payload.exp);
        
        // Révoquer tous les tokens de l'utilisateur
        if (decoded.payload.sub) {
          await jwtService.revokeUserTokens(decoded.payload.sub);
        }
      }
    } catch (error) {
      // Ignorer les erreurs lors du logout
      console.error('Error during logout:', error);
    }
  }

  // Effacer le cookie de refresh token
  const clearCookie = jwtService.generateClearRefreshTokenCookie();
  res.cookie(clearCookie.name, clearCookie.value, clearCookie.options);

  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
}));

/**
 * POST /auth/logout-all
 * Déconnexion de toutes les sessions
 */
router.post('/logout-all', catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      const decoded = jwtService.decodeToken(refreshToken);
      if (decoded && decoded.payload && decoded.payload.sub) {
        // Révoquer tous les tokens de l'utilisateur
        await jwtService.revokeUserTokens(decoded.payload.sub);
      }
    } catch (error) {
      console.error('Error during logout-all:', error);
    }
  }

  // Effacer le cookie de refresh token
  const clearCookie = jwtService.generateClearRefreshTokenCookie();
  res.cookie(clearCookie.name, clearCookie.value, clearCookie.options);

  res.json({
    success: true,
    message: 'Toutes les sessions ont été révoquées'
  });
}));

/**
 * GET /auth/token-info
 * Informations sur le token actuel
 */
router.get('/token-info', catchAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  const refreshToken = req.cookies.refreshToken;
  
  let accessToken = null;
  let refreshTokenInfo = null;
  
  // Extraire le access token du header Authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  }
  
  // Informations sur l'access token
  let accessTokenInfo = null;
  if (accessToken) {
    accessTokenInfo = jwtService.extractTokenInfo(accessToken);
    if (accessTokenInfo) {
      accessTokenInfo.timeRemaining = jwtService.getTokenTimeRemaining(accessToken);
      accessTokenInfo.isExpired = jwtService.isTokenExpired(accessToken);
    }
  }
  
  // Informations sur le refresh token
  if (refreshToken) {
    refreshTokenInfo = jwtService.extractTokenInfo(refreshToken);
    if (refreshTokenInfo) {
      refreshTokenInfo.timeRemaining = jwtService.getTokenTimeRemaining(refreshToken);
      refreshTokenInfo.isExpired = jwtService.isTokenExpired(refreshToken);
    }
  }

  res.json({
    success: true,
    data: {
      accessToken: accessTokenInfo,
      refreshToken: refreshTokenInfo
    }
  });
}));

/**
 * POST /auth/validate
 * Validation des tokens sans les rafraîchir
 */
router.post('/validate', catchAsync(async (req, res) => {
  const { accessToken } = req.body;
  
  if (!accessToken) {
    throw AppError.validation('Access token requis');
  }

  try {
    const decoded = await jwtService.verifyAccessToken(accessToken);
    
    res.json({
      success: true,
      message: 'Token valide',
      data: {
        user: {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          username: decoded.username,
          permissions: decoded.permissions
        },
        token: {
          expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
          issuedAt: decoded.iat
        }
      }
    });
  } catch (error) {
    throw AppError.unauthorized('Token invalide');
  }
}));

/**
 * GET /auth/sessions
 * Liste des sessions actives de l'utilisateur
 */
router.get('/sessions', catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token manquant');
  }

  try {
    const decoded = jwtService.decodeToken(refreshToken);
    if (!decoded || !decoded.payload || !decoded.payload.sub) {
      throw AppError.unauthorized('Token invalide');
    }

    const userTokens = await jwtService.getUserTokens(decoded.payload.sub);
    
    res.json({
      success: true,
      data: {
        sessions: userTokens.map(token => ({
          tokenId: token.tokenId,
          type: token.type,
          createdAt: token.createdAt
        })),
        total: userTokens.length
      }
    });
  } catch (error) {
    throw AppError.unauthorized('Impossible de récupérer les sessions');
  }
}));

module.exports = router;
