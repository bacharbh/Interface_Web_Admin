import { createClient } from 'redis';

export let redisClient;
export let isRedisConnected = false;

export const initRedis = async () => {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    console.error('⚠️ Redis Connection Error:', err.message);
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    console.log('⚡ Connected to Redis (Cache Layer Active)');
    isRedisConnected = true;
  });

  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️ Failed to connect to Redis. API will fallback to MongoDB directly (Graceful Degradation).');
  }
};

/**
 * Middleware de cache avec TTL dynamique.
 * Vérifie si la donnée existe en cache, sinon exécute la requête DB et la met en cache.
 */
export const cacheMiddleware = (ttlSeconds) => {
  return async (req, res, next) => {
    // Contourne le cache si Redis est mort ou si la requête n'est pas un GET
    if (!isRedisConnected || req.method !== 'GET') {
      res.set('X-Cache', 'BYPASS');
      return next();
    }

    // Utilisation de req.originalUrl pour identifier de manière unique la route et les query params
    const key = `cache:${req.originalUrl || req.url}`;

    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cachedData));
      }
    } catch (err) {
      console.error('Redis GET error:', err);
    }

    res.set('X-Cache', 'MISS');
    
    // Intercepte et surcharge res.json pour capturer la réponse sortante
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Met en cache uniquement les requêtes ayant abouti
      if (isRedisConnected && res.statusCode >= 200 && res.statusCode < 300) {
        try {
          redisClient.setEx(key, ttlSeconds, JSON.stringify(body));
        } catch (err) {
          console.error('Redis SET error:', err);
        }
      }
      return originalJson(body);
    };

    next();
  };
};

/**
 * Middleware d'invalidation de cache.
 * Supprime toutes les clés correspondantes au pattern spécifié lors d'une mutation (POST, PUT, DELETE, PATCH).
 */
export const clearCacheMiddleware = (pattern) => {
  return async (req, res, next) => {
    next(); // Ne bloque pas le pipeline de requête (fire-and-forget)
    
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    if (isRedisConnected && isMutation) {
      try {
        // Trouve toutes les clés liées à cette entité (inclut les différentes pages ou query params)
        const keys = await redisClient.keys(`cache:${pattern}*`);
        if (keys.length > 0) {
          await redisClient.del(keys);
          console.log(`🧹 Cache invalidated for pattern: ${pattern} (${keys.length} keys)`);
        }
      } catch (err) {
        console.error('Redis INVALIDATE error:', err);
      }
    }
  };
};
