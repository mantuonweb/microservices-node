const Consul = require('consul');
const axios = require('axios');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');

class OrderService {
  constructor() {
    this.SERVICE_NAME = 'order-service';
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

      if (!config) {
        throw new Error('Empty configuration received from config server');
      }

      process.env = { ...process.env, ...config };
      return process.env;
    } catch (error) {
      logger.error(`Failed to load config from server: ${error.message}`);
      logger.info('Falling back to local environment variables');
      return process.env;
    }
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

  setupShutdownHandlers() {
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }


  async gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    await this.deregisterService();

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
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

  async registerService() {
    if (!this.consul) {
      logger.warn('Cannot register service: Consul client is not initialized');
      return;
    }

    try {
      const serviceDetails = {
        id: this.serviceId,
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

      await new Promise((resolve, reject) => {
        this.consul.agent.service.register(serviceDetails, (err) => {
          if (err) {
            logger.error(`Failed to register service with Consul: ${err.message}`, err);
            reject(err);
            return;
          }
          logger.info(`Service registered with Consul: ${this.serviceId}`);
          resolve();
        });
      });
    } catch (error) {
      logger.error(`Error connecting to Consul: ${error.message}`, error);
      logger.info('Service will run without Consul registration');
    }
  }

  async deregisterService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        this.consul.agent.service.deregister(this.serviceId, (err) => {
          if (err) {
            logger.error('Failed to deregister service from Consul:', err);
            reject(err);
            return;
          }
          logger.info(`Service deregistered from Consul: ${this.serviceId}`);
          resolve();
        });
      });
    } catch (error) {
      logger.error(`Error deregistering from Consul: ${error.message}`);
    }
  }
  async initialize() {
    try {
      // Get configured Express app and PORT
      await this.loadConfig();
      const { app, PORT } = configureApp();
      this.app = app;
      this.PORT = PORT;

      this.serviceId = `${this.SERVICE_NAME}-${this.PORT}`;
      this.CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';

      // Initialize Consul if enabled
      this.initializeConsul();
      
      // Start server with proper error handling
      this.server = await new Promise((resolve, reject) => {
        const server = this.app.listen(this.PORT, async () => {
          try {
            // Register with Consul after server starts
            if (this.CONSUL_ENABLED) {
              await this.registerService();
            }
            logger.info(`Order Service running on port ${this.PORT}`);
            resolve(server);
          } catch (err) {
            reject(err);
          }
        });
        
        server.on('error', (err) => {
          logger.error(`Failed to start server: ${err.message}`);
          reject(err);
        });
      });
      
      this.setupShutdownHandlers();
      return this;
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }
}

const orderService = new OrderService();
orderService.initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = OrderService;