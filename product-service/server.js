require('dotenv').config({ path: './product-service.env' });
const axios = require('axios');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');
const Consul = require('consul');

class ProductService {
  constructor() {
    // Constants
    this.SERVICE_NAME = 'product-service';
    this.ENVIRONMENT = process.env.NODE_ENV || 'dev';
    this.CONFIG_SERVER_URL = process.env.CONFIG_SERVER_URL || 'http://ms-config-service:4000';
    
    this.server = null;
    this.consul = null;
    this.serviceId = null;
    this.port = null;
    this.app = null;
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
      tags: ['microservice', 'product'],
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

        await rabbitMQClient.getInstance().close();
        logger.info('RabbitMQ connection closed');
        
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
  }

  /**
   * Initializes and starts the application
   */
  async initialize() {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Configure Express app
      const configApp = configureApp();
      this.port = configApp.PORT;
      this.app = configApp.app;
      this.serviceId = `${this.SERVICE_NAME}-${this.port}`;
      
      // Initialize Consul
      this.consul = this.initializeConsul();
      
      // Start server
      this.server = this.app.listen(this.port, '::', () => {
        logger.info(`Product Service running on port ${this.port} (IPv4 and IPv6)`);
        
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

// Create and start the service
new ProductService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = ProductService;
