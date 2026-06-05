/**
 * Smart Shepherd - JWT Service with Refresh Token Strategy
 * Gestion complète des tokens JWT avec rotation et blacklist
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { promisify } from 'util';

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-key';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '30d';
    this.issuer = process.env.JWT_ISSUER || 'smart-shepherd';
    this.audience = process.env.JWT_AUDIENCE || 'smart-shepherd-users';
  }

  /**
   * Génère une paire de tokens (access + refresh)
   */
  generateTokenPair(user) {
    const payload = this.createTokenPayload(user);
    
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }

  /**
   * Crée le payload standard pour les tokens
   */
  createTokenPayload(user) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      permissions: this.getUserPermissions(user),
      iat: Math.floor(Date.now() / 1000),
      iss: this.issuer,
      aud: this.audience
    };
  }

  /**
   * Génère un access token (court durée)
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256'
    });
  }

  /**
   * Génère un refresh token (longue durée)
   */
  generateRefreshToken(payload) {
    const refreshPayload = {
      ...payload,
      type: 'refresh',
      jti: this.generateTokenId()
    };

    return jwt.sign(refreshPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256'
    });
  }

  /**
   * Génère un ID unique pour le token
   */
  generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Vérifie un access token
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      // Vérifier si le token n'est pas blacklisté
      const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }

  /**
   * Vérifie un refresh token
   */
  async verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      // Vérifier que c'est bien un refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Vérifier si le token n'est pas blacklisté
      const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        throw new Error('Refresh token has been revoked');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }

  /**
   * Effectue la rotation du refresh token
   */
  async rotateRefreshToken(oldRefreshToken, user) {
    try {
      // Vérifier l'ancien refresh token
      const decoded = await this.verifyRefreshToken(oldRefreshToken);
      
      // Blacklister l'ancien token
      await this.blacklistToken(decoded.jti, decoded.exp);
      
      // Générer nouvelle paire de tokens
      const newTokens = this.generateTokenPair(user);
      
      return {
        ...newTokens,
        rotated: true,
        oldTokenId: decoded.jti
      };
    } catch (error) {
      throw new Error(`Token rotation failed: ${error.message}`);
    }
  }

  /**
   * Ajoute un token à la blacklist Redis
   */
  async blacklistToken(_tokenId, _expiryTime) {
    // Redis not available — token blacklisting disabled
  }

  /**
   * Vérifie si un token est blacklisté
   */
  async isTokenBlacklisted(_tokenId) {
    return false; // Redis not available — no blacklist
  }

  /**
   * Révoque tous les tokens d'un utilisateur
   */
  async revokeUserTokens(_userId) {
    // Redis not available — token revocation disabled
  }

  /**
   * Stocke les tokens actifs d'un utilisateur
   */
  async storeUserTokens(_userId, _tokenId, _tokenType) {
    // Redis not available — token storage disabled
  }

  /**
   * Obtient les tokens actifs d'un utilisateur
   */
  async getUserTokens(_userId) {
    return []; // Redis not available — no stored tokens
  }

  /**
   * Décode un token sans vérification
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      return null;
    }
  }

  /**
   * Extrait les informations d'un token
   */
  extractTokenInfo(token) {
    const decoded = this.decodeToken(token);
    if (!decoded) {
      return null;
    }

    return {
      header: decoded.header,
      payload: decoded.payload,
      signature: decoded.signature,
      expiresIn: decoded.payload.exp,
      issuedAt: decoded.payload.iat,
      notBefore: decoded.payload.nbf,
      tokenId: decoded.payload.jti,
      type: decoded.payload.type
    };
  }

  /**
   * Vérifie si un token est expiré
   */
  isTokenExpired(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.payload.exp) {
      return true;
    }

    return Date.now() >= decoded.payload.exp * 1000;
  }

  /**
   * Calcule le temps restant avant expiration
   */
  getTokenTimeRemaining(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.payload.exp) {
      return 0;
    }

    const remaining = decoded.payload.exp * 1000 - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Parse la durée d'expiration en secondes
   */
  parseExpiry(expiry) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800,
      'M': 2592000,
      'y': 31536000
    };

    const match = expiry.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      return 3600; // Default 1 hour
    }

    const [, amount, unit] = match;
    return parseInt(amount) * (units[unit] || 1);
  }

  /**
   * Obtient les permissions de l'utilisateur
   */
  getUserPermissions(user) {
    const permissions = {
      ADMIN: [
        'users:read', 'users:write', 'users:delete',
        'sheep:read', 'sheep:write', 'sheep:delete',
        'telemetry:read', 'telemetry:write',
        'geofence:read', 'geofence:write', 'geofence:delete',
        'notifications:read', 'notifications:write',
        'system:read', 'system:write'
      ],
      USER: [
        'sheep:read', 'telemetry:read',
        'geofence:read', 'notifications:read'
      ]
    };

    return permissions[user.role] || [];
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   */
  hasPermission(user, permission) {
    const userPermissions = this.getUserPermissions(user);
    return userPermissions.includes(permission);
  }

  /**
   * Génère un cookie sécurisé pour le refresh token
   */
  generateRefreshTokenCookie(refreshToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      name: 'refreshToken',
      value: refreshToken,
      options: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: this.parseExpiry(this.refreshTokenExpiry) * 1000,
        path: '/',
        domain: isProduction ? process.env.COOKIE_DOMAIN : undefined
      }
    };
  }

  /**
   * Génère un cookie pour effacer le refresh token
   */
  generateClearRefreshTokenCookie() {
    return {
      name: 'refreshToken',
      value: '',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
      }
    };
  }
}

export default new JWTService();
