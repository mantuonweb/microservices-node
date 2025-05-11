const axios = require('axios');
const Consul = require('consul');
const logger = require('../utils/logger');

class BaseService {
  constructor(options = {}) {
    // Service identification
    this.SERVICE_NAME = options.serviceName || 'unknown-service';
    this.ENVIRONMENT = process.env.NODE_ENV || 'local';
    this.CONFIG_SERVER_URL = process.env.CONFIG_SERVER_URL || (process.env.NODE_ENV ? 'http://ms-config-service:4000' : 'http://localhost:4000');
    
    // Runtime properties
    this.server = null;
    this.consul = null;
    this.serviceId = null;
    this.port = null;
    this.app = null;
    this.tags = options.tags || ['microservice'];
  }

  /**
   * Loads configuration from config server or falls back to local env vars
   */
  async loadConfig() {
    try {
      const configUrl = `${this.CONFIG_SERVER_URL}/config/${this.SERVICE_NAME}/${this.ENVIRONMENT}`;
      logger.info(`Loading configuration from ${configUrl}`);
      
      const response = await axios.get(configUrl);
      const config = response.data;
      
      process.env = { ...process.env, ...config };
      return process.env;
    } catch (error) {
      logger.error(`Failed to load config from server: ${error.message}`);
      logger.info('Falling back to local environment variables');
      return process.env;
    }
  }

  /**
   * Initializes Consul client if enabled
   */
  initializeConsul() {
    const CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';
    
    if (!CONSUL_ENABLED) {
      logger.info('Consul integration disabled by configuration');
      return null;
    }
    
    try {
      const consulClient = new Consul({
        host: process.env.CONSUL_HOST || 'localhost',
        port: process.env.CONSUL_PORT || 8500,
        promisify: true,
      });
      
      logger.info(
        `Consul client initialized with host: ${process.env.CONSUL_HOST || 'localhost'}, 
         port: ${process.env.CONSUL_PORT || 8500}`
      );
      
      return consulClient;
    } catch (error) {
      logger.error(`Failed to initialize Consul client: ${error.message}`);
      return null;
    }
  }

  /**
   * Registers service with Consul
   */
  registerService() {
    if (!this.consul) {
      logger.warn('Cannot register service: Consul client is not initialized');
      return;
    }

    const serviceHost = process.env.SERVICE_HOST || 'localhost';
    
    const serviceDetails = {
      id: this.serviceId,
      name: this.SERVICE_NAME,
      address: serviceHost,
      port: parseInt(this.port),
      tags: this.tags,
      check: {
        http: `http://${serviceHost}:${this.port}/health`,
        interval: '15s',
        timeout: '5s',
      },
    };

    logger.info(`Registering service with Consul: ${JSON.stringify(serviceDetails)}`);

    this.consul.agent.service.register(serviceDetails)
      .then(() => {
        logger.info(`Service registered with Consul: ${this.serviceId}`);
      })
      .catch((err) => {
        logger.error(`Failed to register service with Consul: ${err.message}`);
      });
  }

  /**
   * Deregisters service from Consul
   */
  async deregisterService() {
    if (!this.consul) {
      return;
    }

    try {
      await this.consul.agent.service.deregister(this.serviceId);
      logger.info(`Service deregistered from Consul: ${this.serviceId}`);
    } catch (err) {
      logger.error(`Failed to deregister service from Consul: ${err.message}`);
    }
  }

  /**
   * Creates a graceful shutdown handler
   */
  createShutdownHandler() {
    return async () => {
      logger.info('Starting graceful shutdown...');
      
      try {
        await this.deregisterService();
        
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
  }

  /**
   * Configure the application - to be implemented by subclasses
   */
  configureApp() {
    throw new Error('configureApp method must be implemented by subclass');
  }

  /**
   * Initializes and starts the application
   */
  async initialize() {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Configure Express app - this will be implemented by subclasses
      const configApp = this.configureApp();
      this.port = configApp.PORT;
      this.app = configApp.app;
      this.serviceId = `${this.SERVICE_NAME}-${this.port}`;
      
      // Initialize Consul
      this.consul = this.initializeConsul();
      
      // Start server
      this.server = this.app.listen(this.port, '::', () => {
        logger.info(`${this.SERVICE_NAME} running on port ${this.port} (IPv4 and IPv6)`);
        
        if (this.consul) {
          this.registerService();
        } else {
          logger.info('Skipping Consul registration - Consul client not available or disabled');
        }
      });
      
      // Setup graceful shutdown
      const shutdownHandler = this.createShutdownHandler();
      process.on('SIGTERM', shutdownHandler);
      process.on('SIGINT', shutdownHandler);
      
      return this;
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }
}

module.exports = BaseService;