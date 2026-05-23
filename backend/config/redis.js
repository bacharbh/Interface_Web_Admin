/**
 * Smart Shepherd - Redis Configuration
 * Configuration Redis pour blacklist et cache
 */

const redis = require('redis');
const logger = require('../utils/logger');

// Simple in-memory cache fallback with Redis-like async API for local dev
class InMemoryCache {
  constructor() {
    this.store = new Map();
    this.hashes = new Map();
    this.lists = new Map();
    this.status = 'ready';
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async set(key, value) {
    this.store.set(key, String(value));
    return 'OK';
  }

  async setEx(key, ttl, value) {
    await this.set(key, value);
    // naive TTL: not enforced for simplicity
    return 'OK';
  }

  async del(key) {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern) {
    const re = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return Array.from(this.store.keys()).filter(k => re.test(k));
  }

  async expire() { return 1; }
  async ttl() { return -1; }

  async hGet(key, field) {
    const map = this.hashes.get(key);
    return map && map.has(field) ? map.get(field) : null;
  }

  async hSet(key, field, value) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key).set(field, String(value));
    return 1;
  }

  async hGetAll(key) {
    const map = this.hashes.get(key);
    if (!map) return {};
    const obj = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    return obj;
  }

  async lPush(key, value) {
    if (!this.lists.has(key)) this.lists.set(key, []);
    this.lists.get(key).unshift(value);
    return this.lists.get(key).length;
  }

  async rPop(key) {
    const arr = this.lists.get(key) || [];
    return arr.pop() || null;
  }

  async lRange(key, start, stop) {
    const arr = this.lists.get(key) || [];
    return arr.slice(start, stop + 1);
  }

  async incr(key) {
    const val = parseInt(this.store.get(key) || '0', 10) + 1;
    this.store.set(key, String(val));
    return val;
  }

  async decr(key) {
    const val = parseInt(this.store.get(key) || '0', 10) - 1;
    this.store.set(key, String(val));
    return val;
  }

  async quit() {
    this.status = 'quit';
    return;
  }
}

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      keyPrefix: 'smartshepherd:',
      connectTimeout: 10000,
      commandTimeout: 5000
    };
  }

  async connect() {
    try {
      this.client = redis.createClient(this.config);

      // Gestionnaires d'événements
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('error', (error) => {
        logger.error('Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis client reconnecting');
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error('Failed to connect to Redis, switching to in-memory fallback:', error);
      // In-memory fallback to allow the app to keep running in dev without Redis
      this.client = new InMemoryCache();
      this.isConnected = false;
      return this.client;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  // Wrapper methods avec gestion d'erreur
  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      throw error;
    }
  }

  async set(key, value, ttl) {
    try {
      if (ttl) {
        return await this.client.setEx(key, ttl, value);
      }
      return await this.client.set(key, value);
    } catch (error) {
      logger.error('Redis SET error:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      throw error;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      throw error;
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error:', error);
      throw error;
    }
  }

  async setex(key, ttl, value) {
    try {
      return await this.client.setEx(key, ttl, value);
    } catch (error) {
      logger.error('Redis SETEX error:', error);
      throw error;
    }
  }

  async expire(key, ttl) {
    try {
      return await this.client.expire(key, ttl);
    } catch (error) {
      logger.error('Redis EXPIRE error:', error);
      throw error;
    }
  }

  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error:', error);
      throw error;
    }
  }

  async hget(key, field) {
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      logger.error('Redis HGET error:', error);
      throw error;
    }
  }

  async hset(key, field, value) {
    try {
      return await this.client.hSet(key, field, value);
    } catch (error) {
      logger.error('Redis HSET error:', error);
      throw error;
    }
  }

  async hdel(key, field) {
    try {
      return await this.client.hDel(key, field);
    } catch (error) {
      logger.error('Redis HDEL error:', error);
      throw error;
    }
  }

  async hgetall(key) {
    try {
      return await this.client.hGetAll(key);
    } catch (error) {
      logger.error('Redis HGETALL error:', error);
      throw error;
    }
  }

  async lpush(key, value) {
    try {
      return await this.client.lPush(key, value);
    } catch (error) {
      logger.error('Redis LPUSH error:', error);
      throw error;
    }
  }

  async rpop(key) {
    try {
      return await this.client.rPop(key);
    } catch (error) {
      logger.error('Redis RPOP error:', error);
      throw error;
    }
  }

  async lrange(key, start, stop) {
    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      logger.error('Redis LRANGE error:', error);
      throw error;
    }
  }

  async incr(key) {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error:', error);
      throw error;
    }
  }

  async decr(key) {
    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error('Redis DECR error:', error);
      throw error;
    }
  }
}

// Singleton instance
const redisService = new RedisService();

// Auto-connect
redisService.connect().catch(error => {
  logger.error('Failed to initialize Redis:', error);
});

module.exports = redisService;
