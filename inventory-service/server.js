require('dotenv').config({ path: './inventory-service.env' });
const Consul = require('consul');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');

class InventoryService {
  constructor() {
    // Get configured Express app and PORT
    const { app, PORT } = configureApp();
    this.app = app;
    this.PORT = PORT;
    this.SERVICE_NAME = 'inventory-service';
    this.SERVICE_ID = `${this.SERVICE_NAME}-${this.PORT}`;
    this.server = null;
    this.consul = null;
    this.CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';
    
    // Initialize Consul client if enabled
    this.initializeConsul();
    
    // Setup graceful shutdown handlers
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  initializeConsul() {
    if (this.CONSUL_ENABLED) {
      try {
        this.consul = new Consul({
          host: process.env.CONSUL_HOST || 'localhost',
          port: process.env.CONSUL_PORT || 8500,
          promisify: true,
        });
        logger.info('Consul client initialized');
      } catch (error) {
        logger.error('Failed to initialize Consul client:', error.message);
      }
    } else {
      logger.info('Consul integration disabled by configuration');
    }
  }

  initialize() {
    this.server = this.app.listen(this.PORT, () => {
      this.registerService();
      logger.info(`Inventory Service running on port ${this.PORT}`);
    });
    return this;
  }

  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    this.deregisterService();
    
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
      });
    }

    try {
      await rabbitMQClient.close();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  registerService() {
    if (!this.consul) {
      logger.warn('Cannot register service: Consul client is not initialized');
      return;
    }

    try {
      const serviceDetails = {
        id: this.SERVICE_ID,
        name: this.SERVICE_NAME,
        address: process.env.SERVICE_HOST || 'localhost',
        port: parseInt(this.PORT),
        tags: ['microservice', 'order'],
        check: {
          http: `http://${process.env.SERVICE_HOST || 'localhost'}:${this.PORT}/health`,
          interval: '15s',
          timeout: '5s',
        },
      };

      logger.info(
        `Attempting to register service with Consul: ${JSON.stringify(serviceDetails)}`
      );

      this.consul.agent.service.register(serviceDetails, (err) => {
        if (err) {
          logger.error(
            `Failed to register service with Consul: ${err.message}`,
            err
          );
          return;
        }
        logger.info(`Service registered with Consul: ${this.SERVICE_ID}`);
      });
    } catch (error) {
      logger.error(`Error connecting to Consul: ${error.message}`, error);
      logger.info('Service will run without Consul registration');
    }
  }

  deregisterService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      return;
    }

    this.consul.agent.service.deregister(this.SERVICE_ID, (err) => {
      if (err) {
        logger.error('Failed to deregister service from Consul:', err);
        return;
      }
      logger.info(`Service deregistered from Consul: ${this.SERVICE_ID}`);
    });
  }
}

// Create and start the service
const inventoryService = new InventoryService().initialize();

module.exports = inventoryService; // Export for testing or external access
