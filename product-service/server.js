require('dotenv').config({ path: './product-service.env' });
const axios = require('axios');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');
const Consul = require('consul'); // Make sure this import is added
// Load configuration from config server
const ENVIRONMENT = process.env.NODE_ENV || 'dev';
async function loadConfig() {
  const CONFIG_SERVER_URL = 'http://ms-config-service:4000';
  try {
    logger.info(
      `Loading configuration from ${CONFIG_SERVER_URL}/config/${SERVICE_NAME}/${ENVIRONMENT}`
    );
    const response = await axios.get(
      `${CONFIG_SERVER_URL}/config/${SERVICE_NAME}/${ENVIRONMENT}`
    );
    console.log(`${CONFIG_SERVER_URL}/config/${SERVICE_NAME}/${ENVIRONMENT}`);
    const config = response.data;
    process.env = { ...process.env, ...config };
    return process.env;
  } catch (error) {
    logger.error(`Failed to load config from server: ${error.message}`, error);
    logger.info('Falling back to local environment variables');
    return null;
  }
}

const SERVICE_NAME = 'product-service';
let SERVICE_ID = '';
let consul = null;
let PORT;
let app;
async function initializeApp() {
  await loadConfig();
  const configApp =  configureApp();
  PORT = configApp.PORT;
  app = configApp.app;
  SERVICE_ID = `${SERVICE_NAME}-${PORT}`;
  // Initialize Consul client if enabled

  const CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';

  if (CONSUL_ENABLED) {
    try {
      consul = new Consul({
        host: process.env.CONSUL_HOST || 'localhost',
        port: process.env.CONSUL_PORT || 8500,
        promisify: true,
      });
      logger.info(
        `Consul client initialized with host: ${process.env.CONSUL_HOST || 'localhost'
        }, port: ${process.env.CONSUL_PORT || 8500}`
      );
    } catch (error) {
      logger.error(`Failed to initialize Consul client: ${error.message}`, error);
    }
  } else {
    logger.info('Consul integration disabled by configuration');
  }
  // Get configured Express app and PORT

  // Start Server

  const server = app.listen(PORT, '::', () => {
    if (CONSUL_ENABLED && consul) {
      registerService();
    } else {
      logger.info(
        'Skipping Consul registration - Consul client not available or disabled'
      );
    }

    logger.info(`Product Service running on port ${PORT} (IPv4 and IPv6)`);
  });
  // Graceful shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  return { server, consul, SERVICE_ID };
}


async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  deregisterService();
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await rabbitMQClient.getInstance().close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

function registerService() {
  if (!consul) {
    logger.warn('Cannot register service: Consul client is not initialized');
    return;
  }

  try {
    const serviceDetails = {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      address: process.env.SERVICE_HOST || 'localhost',
      port: parseInt(PORT),
      tags: ['microservice', 'product'],
      check: {
        http: `http://${process.env.SERVICE_HOST || 'localhost'
          }:${PORT}/health`,
        interval: '15s',
        timeout: '5s',
      },
    };

    logger.info(
      `Attempting to register service with Consul: ${JSON.stringify(
        serviceDetails
      )}`
    );

    consul.agent.service.register(serviceDetails, (err) => {
      if (err) {
        logger.error(
          `Failed to register service with Consul: ${err.message}`,
          err
        );
        return;
      }
      logger.info(`Service registered with Consul: ${SERVICE_ID}`);
    });
  } catch (error) {
    logger.error(`Error connecting to Consul: ${error.message}`, error);
    logger.info('Service will run without Consul registration');
  }
}

// Deregister service from Consul
function deregisterService() {
  if (!consul || !CONSUL_ENABLED) {
    return;
  }

  consul.agent.service.deregister(SERVICE_ID, (err) => {
    if (err) {
      logger.error('Failed to deregister service from Consul:', err);
      return;
    }
    logger.info(`Service deregistered from Consul: ${SERVICE_ID}`);
  });
}

initializeApp().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});
// consul agent -dev
// http://localhost:8500/ui/dc1/services
