const redis = require('redis');
const logger = require('../utils/logger');
/**
 * RedisClient - A singleton class for Redis operations
 * Implements connection management and basic CRUD operations for Redis
 */
class RedisClient {
  /**
   * Private instance - follows the Singleton pattern
   * @private
   */
  static #instance;

  /**
   * Get the singleton instance of RedisClient
   * @param {Object} config - Redis configuration options
   * @returns {RedisClient} The singleton instance
   */
  static getInstance(config = {}) {
    if (!RedisClient.#instance) {
      RedisClient.#instance = new RedisClient(config);
    }
    return RedisClient.#instance;
  }

  /**
   * Private constructor to prevent direct instantiation
   * @param {Object} config - Redis configuration options
   * @private
   */
  constructor(config = {}) {
    this.ENVIRONMENT = process.env.NODE_ENV || 'local';
    this.config = {
      url: this.ENVIRONMENT == 'local' ? `redis://loclahost:6379` : config.url || 'redis://ms-redis:6379',
      retryStrategy: config.retryStrategy || ((options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('The server refused the connection');
        }
        if (options.totalRetryTime > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      })
    };

    this.client = null;
    this.isConnected = false;
  }

  /**
   * Connect to Redis server
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) return;

    try {
      this.client = redis.createClient(this.config);

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        logger.info('Reconnecting to Redis...');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.isConnected || !this.client) return;

    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  /**
   * Get a value from Redis
   * @param {string} key - The key to retrieve
   * @returns {Promise<any>} The value associated with the key
   */
  async get(key) {
    if (!this.isConnected) await this.connect();

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting key ${key} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Set a value in Redis
   * @param {string} key - The key to set
   * @param {any} value - The value to store
   * @param {Object} options - Additional options like expiry time
   * @returns {Promise<boolean>} Success indicator
   */
  async set(key, value, options = {}) {
    if (!this.isConnected) await this.connect();

    try {
      const stringValue = JSON.stringify(value);
      if (options.expiry) {
        await this.client.set(key, stringValue, { EX: options.expiry });
      } else {
        await this.client.set(key, stringValue);
      }
      return true;
    } catch (error) {
      logger.error(`Error setting key ${key} in Redis:`, error);
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<boolean>} Success indicator
   */
  async delete(key) {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting key ${key} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Update a value in Redis (alias for set)
   * @param {string} key - The key to update
   * @param {any} value - The new value
   * @param {Object} options - Additional options like expiry time
   * @returns {Promise<boolean>} Success indicator
   */
  async update(key, value, options = {}) {
    return this.set(key, value, options);
  }

  /**
   * Check if a key exists in Redis
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} Whether the key exists
   */
  async exists(key) {
    if (!this.isConnected) await this.connect();

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking if key ${key} exists in Redis:`, error);
      throw error;
    }
  }

  /**
   * Get keys matching a pattern
   * @param {string} pattern - The pattern to match
   * @returns {Promise<string[]>} Array of matching keys
   */
  async getKeys(pattern) {
    if (!this.isConnected) await this.connect();

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Error getting keys with pattern ${pattern} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Clear all keys in the Redis database
   * @returns {Promise<boolean>} Success indicator
   */
  async flushAll() {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Error flushing Redis database:', error);
      throw error;
    }
  }

  /**
   * Get a JSON document from Redis
   * @param {string} key - The key to retrieve
   * @param {string} path - The JSON path (default: '.')
   * @returns {Promise<any>} The JSON document
   */
  async getJSON(key, path = '.') {
    if (!this.isConnected) await this.connect();

    try {
      const value = await this.client.sendCommand(['JSON.GET', key, path]);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting JSON ${key} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Set a JSON document in Redis
   * @param {string} key - The key to set
   * @param {string} path - The JSON path (default: '.')
   * @param {any} value - The JSON document to store
   * @param {Object} options - Additional options like expiry time
   * @returns {Promise<boolean>} Success indicator
   */
  async setJSON(key, path = '.', value, options = {}) {
    if (!this.isConnected) await this.connect();

    try {
      // Convert the value to a JSON string before sending it
      const jsonString = JSON.stringify(value);
      await this.client.sendCommand(['JSON.SET', key, path, jsonString]);
      
      if (options.expiry) {
        await this.client.expire(key, options.expiry);
      }
      return true;
    } catch (error) {
      logger.error(`Error setting JSON ${key} in Redis:`, error);
      throw error;
    }
  }

  /**
   * Delete a JSON document or a path in a JSON document
   * @param {string} key - The key to delete
   * @param {string} path - The JSON path (default: '.')
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteJSON(key, path = '.') {
    if (!this.isConnected) await this.connect();

    try {
      await this.client.sendCommand(['JSON.DEL', key, path]);
      return true;
    } catch (error) {
      logger.error(`Error deleting JSON ${key} from Redis:`, error);
      throw error;
    }
  }

  /**
   * Check if a key contains a JSON document
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} Whether the key contains a JSON document
   */
  async isJSON(key) {
    if (!this.isConnected) await this.connect();

    try {
      const type = await this.client.type(key);
      return type === 'ReJSON-RL';
    } catch (error) {
      logger.error(`Error checking if key ${key} is JSON in Redis:`, error);
      throw error;
    }
  }
}

module.exports = RedisClient;