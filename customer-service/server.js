const Consul = require('consul');
const axios = require('axios');
const logger = require('./utils/logger');
const configureApp = require('./config/App');

class CustomerService {
  constructor() {
    // Constants
    this.SERVICE_NAME = 'customer-service';
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
  initializeConsul() {
    this.CONSUL_ENABLED = process.env.CONSUL_ENABLED;
    if (this.CONSUL_ENABLED) {
      try {
        this.consul = new Consul({
          host: process.env.CONSUL_HOST || 'localhost',
          port: process.env.CONSUL_PORT || 8500,
          promisify: true,
        });
        logger.info('Consul client initialized');
        return this.consul;
      } catch (error) {
        logger.error('Failed to initialize Consul client:', error.message);
        return null;
      }
    } else {
      logger.info('Consul integration disabled by configuration');
      return null;
    }
  }

  registerService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      logger.info('Skipping Consul registration (disabled or not connected)');
      return;
    }

    try {
      this.consul.agent.service.register(
        {
          id: this.serviceId,
          name: this.SERVICE_NAME,
          address: process.env.SERVICE_HOST || 'localhost',
          port: parseInt(this.port),
          tags: ['microservice', 'customer'],
          check: {
            http: `http://${process.env.SERVICE_HOST || 'localhost'}:${this.port}/health`,
            interval: '15s',
            timeout: '5s',
          },
        },
        (err) => {
          if (err) {
            logger.error('Failed to register service with Consul:', err);
            return;
          }
          logger.info(`Service registered with Consul: ${this.serviceId}`);
        }
      );
    } catch (error) {
      logger.error('Error connecting to Consul:', error.message);
      logger.info('Service will run without Consul registration');
    }
  }

  deregisterService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      return;
    }

    this.consul.agent.service.deregister(this.serviceId, (err) => {
      if (err) {
        logger.error('Failed to deregister service from Consul:', err);
        return;
      }
      logger.info(`Service deregistered from Consul: ${this.serviceId}`);
    });
  }


  setupShutdownHandlers(signal) {
    logger.info(`${signal} signal received: shutting down...`);
    this.deregisterService();

    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
  createShutdownHandler() {
    return (signal) => this.setupShutdownHandlers(signal);
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
        logger.info(`Customer Service running on port ${this.port} (IPv4 and IPv6)`);

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

new CustomerService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = CustomerService;