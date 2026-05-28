# Smart Shepherd - JWT Refresh Token Flow Documentation

## Overview

Ce document décrit le flow complet de gestion des tokens JWT pour Smart Shepherd, incluant l'émission d'access tokens (15 minutes) et refresh tokens (30 jours), le stockage sécurisé via cookies httpOnly, la rotation des tokens, et la gestion de la révocation.

## Architecture des Tokens

### Access Token
- **Durée**: 15 minutes
- **Usage**: Authentification des requêtes API
- **Stockage**: Client-side (localStorage/memory)
- **Rotation**: Non (remplacé par refresh token)

### Refresh Token
- **Durée**: 30 jours
- **Usage**: Rafraîchissement de l'access token
- **Stockage**: Cookie httpOnly sécurisé
- **Rotation**: Oui (à chaque utilisation)

## Flow d'Authentification

### 1. Login Initial

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "username": "jean_dupont",
      "email": "user@example.com",
      "role": "USER"
    }
  }
}
```

**Cookie httpOnly généré:**
```http
Set-Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; 
             HttpOnly; 
             Secure; 
             SameSite=Strict; 
             Max-Age=2592000; 
             Path=/; 
             Domain=.smartshepherd.com
```

### 2. Utilisation de l'Access Token

```http
GET /api/sheep
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Rafraîchissement Automatique

**Client détecte token expiré (401):**
```javascript
// Appel automatique au refresh endpoint
try {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Important pour les cookies
  });
  
  const data = await response.json();
  
  // Mettre à jour le localStorage avec le nouveau token
  localStorage.setItem('accessToken', data.data.accessToken);
  
  // Réessayer la requête originale
  retryOriginalRequest();
} catch (error) {
  // Rediriger vers login
  window.location.href = '/login';
}
```

**Endpoint /auth/refresh:**
```http
POST /api/auth/refresh
Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Réponse avec nouveau token:**
```json
{
  "success": true,
  "message": "Token rafraîchi avec succès",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "rotated": true,
    "user": { ... }
  }
}
```

## Rotation des Refresh Tokens

### Processus de Rotation

1. **Vérification** du refresh token actuel
2. **Blacklisting** immédiat de l'ancien refresh token
3. **Génération** d'une nouvelle paire de tokens
4. **Stockage** du nouveau refresh token dans Redis
5. **Envoi** du nouveau refresh token via cookie

### Sécurité de la Rotation

```javascript
// Dans jwtService.js
async rotateRefreshToken(oldRefreshToken, user) {
  // 1. Vérifier l'ancien token
  const decoded = await this.verifyRefreshToken(oldRefreshToken);
  
  // 2. Blacklister l'ancien token
  await this.blacklistToken(decoded.jti, decoded.exp);
  
  // 3. Générer nouvelle paire
  const newTokens = this.generateTokenPair(user);
  
  return {
    ...newTokens,
    rotated: true,
    oldTokenId: decoded.jti
  };
}
```

## Blacklist Redis

### Structure des Clés

```
blacklist:{tokenId} -> "1" (TTL: temps restant du token)
user_tokens:{userId}:{tokenId} -> {type, createdAt}
```

### Opérations Redis

```javascript
// Blacklist un token
await redis.setex(`blacklist:${tokenId}`, ttl, '1');

// Vérifier si blacklisté
const isBlacklisted = await redis.get(`blacklist:${tokenId}`);

// Révoquer tous les tokens utilisateur
await redis.del(`user_tokens:${userId}:*`);
```

## Déconnexion et Révocation

### Logout Simple

```http
POST /api/auth/logout
Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Actions:**
1. Blacklist du refresh token
2. Suppression du cookie
3. Nettoyage des tokens utilisateur

### Logout All Sessions

```http
POST /api/auth/logout-all
Cookie: refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Actions:**
1. Révocation de TOUS les tokens de l'utilisateur
2. Suppression du cookie
3. Force reconnexion sur tous les appareils

## Sécurité des Cookies

### Configuration Production

```javascript
const refreshCookie = {
  name: 'refreshToken',
  value: refreshToken,
  options: {
    httpOnly: true,        // Non accessible via JavaScript
    secure: true,          // HTTPS uniquement
    sameSite: 'strict',    // Protection CSRF
    maxAge: 2592000,      // 30 jours
    path: '/',             // Disponible sur tout le site
    domain: '.smartshepherd.com' // Sous-domaines
  }
};
```

### Headers de Sécurité

```http
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; 
             Max-Age=2592000; Path=/; Domain=.smartshepherd.com
```

## Middleware d'Authentification

### Flow de Validation

1. **Extraire** l'access token du header Authorization
2. **Vérifier** la validité du token
3. **Si invalide**: Essayer le refresh token
4. **Si refresh valide**: Générer nouvel access token
5. **Retourner** le nouveau token dans `X-New-Access-Token`

### Exemple d'Implémentation

```javascript
const authenticate = async (req, res, next) => {
  try {
    // Essayer l'access token
    const token = req.headers.authorization?.substring(7);
    const decoded = await jwtService.verifyAccessToken(token);
    req.user = await User.findById(decoded.sub);
    next();
  } catch (error) {
    // Essayer le refresh token
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const decoded = await jwtService.verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.sub);
      const newAccessToken = jwtService.generateAccessToken(user);
      
      res.setHeader('X-New-Access-Token', newAccessToken);
      req.user = user;
      next();
    } else {
      throw AppError.unauthorized('Session expirée');
    }
  }
};
```

## Gestion des Erreurs

### Token Expiré

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Session expirée, veuillez vous reconnecter",
    "statusCode": 401,
    "timestamp": "2023-09-15T10:30:00.000Z"
  }
}
```

### Token Révoqué

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token has been revoked",
    "statusCode": 401,
    "timestamp": "2023-09-15T10:30:00.000Z"
  }
}
```

## Monitoring et Logging

### Métriques à Surveiller

- **Taux de réussite** du refresh token
- **Nombre de tokens blacklistés**
- **Durée de vie moyenne** des sessions
- **Tentatives d'utilisation** de tokens révoqués

### Logs Importants

```javascript
// Succès de refresh
logger.info('Token refreshed successfully', {
  userId: decoded.sub,
  oldTokenId: decoded.jti,
  newTokenId: newDecoded.jti,
  ip: req.ip
});

// Échec de refresh
logger.warn('Token refresh failed', {
  error: error.message,
  ip: req.ip,
  userAgent: req.get('User-Agent')
});
```

## Client Side Implementation

### React Hook Example

```javascript
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.data.accessToken);
        return data.data.accessToken;
      }
    } catch (error) {
      logout();
    }
  };

  const apiCall = async (url, options = {}) => {
    const token = localStorage.getItem('accessToken');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        // Réessayer avec le nouveau token
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      }
    }

    return response;
  };

  return { user, loading, apiCall, refreshToken };
};
```

## Best Practices

### Sécurité
- **Toujours** utiliser HTTPS en production
- **Jamais** stocker les refresh tokens dans localStorage
- **Implémenter** la rotation des refresh tokens
- **Utiliser** des cookies httpOnly + Secure
- **Surveiller** les tentatives d'abus

### Performance
- **Cache** les vérifications Redis
- **Limit** la taille des blacklist
- **Monitor** les temps de réponse
- **Optimize** les requêtes Redis

### UX
- **Rafraîchissement transparent** pour l'utilisateur
- **Messages clairs** en cas d'erreur
- **Redirection automatique** vers login
- **Indicateur de session active**

## Configuration Environment Variables

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
JWT_ISSUER=smart-shepherd
JWT_AUDIENCE=smart-shepherd-users

# Cookie Configuration
COOKIE_DOMAIN=.smartshepherd.com
NODE_ENV=production

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

Ce flow assure une sécurité maximale tout en offrant une expérience utilisateur fluide avec des reconnexions transparentes.
