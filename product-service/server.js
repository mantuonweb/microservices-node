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

// Global variables
let app;
let server;
let PORT;
let SERVICE_ID;
let consul = null;

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
 */
function registerService() {
  if (!consul) {
    logger.warn('Cannot register service: Consul client is not initialized');
    return;
  }

  const serviceHost = process.env.SERVICE_HOST || 'localhost';
  
  const serviceDetails = {
    id: SERVICE_ID,
    name: SERVICE_NAME,
    address: serviceHost,
    port: parseInt(PORT),
    tags: ['microservice', 'product'],
    check: {
      http: `http://${serviceHost}:${PORT}/health`,
      interval: '15s',
      timeout: '5s',
    },
  };

  logger.info(`Registering service with Consul: ${JSON.stringify(serviceDetails)}`);

  consul.agent.service.register(serviceDetails)
    .then(() => {
      logger.info(`Service registered with Consul: ${SERVICE_ID}`);
    })
    .catch((err) => {
      logger.error(`Failed to register service with Consul: ${err.message}`);
    });
}

/**
 * Deregisters service from Consul
 */
async function deregisterService() {
  if (!consul) {
    return;
  }

  try {
    await consul.agent.service.deregister(SERVICE_ID);
    logger.info(`Service deregistered from Consul: ${SERVICE_ID}`);
  } catch (err) {
    logger.error(`Failed to deregister service from Consul: ${err.message}`);
  }
}

/**
 * Handles graceful shutdown
 */
async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  
  try {
    await deregisterService();
    
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
    PORT = configApp.PORT;
    app = configApp.app;
    SERVICE_ID = `${SERVICE_NAME}-${PORT}`;
    
    // Initialize Consul
    consul = initializeConsul();
    
    // Start server
    server = app.listen(PORT, '::', () => {
      logger.info(`Product Service running on port ${PORT} (IPv4 and IPv6)`);
      
      if (consul) {
        registerService();
      } else {
        logger.info('Skipping Consul registration - Consul client not available or disabled');
      }
    });
    
    // Setup graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    return { server, consul, SERVICE_ID };
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
