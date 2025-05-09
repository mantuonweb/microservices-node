require('dotenv').config({ path: './product-service.env' });
const axios = require('axios');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');
const Consul = require('consul');

// Constants
const SERVICE_NAME = 'product-service';
const ENVIRONMENT = process.env.NODE_ENV || 'dev';
const CONFIG_SERVER_URL = process.env.CONFIG_SERVER_URL || 'http://ms-config-service:4000';

/**
 * Loads configuration from config server or falls back to local env vars
 */
async function loadConfig() {
  try {
    const configUrl = `${CONFIG_SERVER_URL}/config/${SERVICE_NAME}/${ENVIRONMENT}`;
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
function initializeConsul() {
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
 * @param {Object} consul - Consul client
 * @param {string} serviceId - Service ID
 * @param {number} port - Service port
 */
function registerService(consul, serviceId, port) {
  if (!consul) {
    logger.warn('Cannot register service: Consul client is not initialized');
    return;
  }

  const serviceHost = process.env.SERVICE_HOST || 'localhost';
  
  const serviceDetails = {
    id: serviceId,
    name: SERVICE_NAME,
    address: serviceHost,
    port: parseInt(port),
    tags: ['microservice', 'product'],
    check: {
      http: `http://${serviceHost}:${port}/health`,
      interval: '15s',
      timeout: '5s',
    },
  };

  logger.info(`Registering service with Consul: ${JSON.stringify(serviceDetails)}`);

  consul.agent.service.register(serviceDetails)
    .then(() => {
      logger.info(`Service registered with Consul: ${serviceId}`);
    })
    .catch((err) => {
      logger.error(`Failed to register service with Consul: ${err.message}`);
    });
}

/**
 * Deregisters service from Consul
 * @param {Object} consul - Consul client
 * @param {string} serviceId - Service ID
 */
async function deregisterService(consul, serviceId) {
  if (!consul) {
    return;
  }

  try {
    await consul.agent.service.deregister(serviceId);
    logger.info(`Service deregistered from Consul: ${serviceId}`);
  } catch (err) {
    logger.error(`Failed to deregister service from Consul: ${err.message}`);
  }
}

/**
 * Creates a graceful shutdown handler
 * @param {Object} server - HTTP server
 * @param {Object} consul - Consul client
 * @param {string} serviceId - Service ID
 */
function createShutdownHandler(server, consul, serviceId) {
  return async function gracefulShutdown() {
    logger.info('Starting graceful shutdown...');
    
    try {
      await deregisterService(consul, serviceId);
      
      server.close(() => {
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
async function initializeApp() {
  try {
    // Load configuration
    await loadConfig();
    
    // Configure Express app
    const configApp = configureApp();
    const port = configApp.PORT;
    const app = configApp.app;
    const serviceId = `${SERVICE_NAME}-${port}`;
    
    // Initialize Consul
    const consul = initializeConsul();
    
    // Start server
    const server = app.listen(port, '::', () => {
      logger.info(`Product Service running on port ${port} (IPv4 and IPv6)`);
      
      if (consul) {
        registerService(consul, serviceId, port);
      } else {
        logger.info('Skipping Consul registration - Consul client not available or disabled');
      }
    });
    
    // Setup graceful shutdown
    const shutdownHandler = createShutdownHandler(server, consul, serviceId);
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    
    return { server, consul, serviceId };
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

// Start the application
initializeApp().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});
