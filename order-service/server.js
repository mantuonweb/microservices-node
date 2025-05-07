require('dotenv').config({ path: './order-service.env' });
const Consul = require('consul');
const logger = require('./utils/logger');
const configureApp = require('./config/App');
const rabbitMQClient = require('./utils/RabbitMQClient');

// Get configured Express app and PORT
const { app, PORT } = configureApp();
const SERVICE_NAME = 'order-service';
const SERVICE_ID = `${SERVICE_NAME}-${PORT}`;

// Initialize Consul client if enabled
let consul = null;
const CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';

if (CONSUL_ENABLED) {
  try {
    consul = new Consul({
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
// Start Server
const server = app.listen(PORT, () => {
  registerService();
  logger.info(`Product Service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');
  deregisterService();
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await rabbitMQClient.close();
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
      tags: ['microservice', 'order'],
      check: {
        http: `http://${
          process.env.SERVICE_HOST || 'localhost'
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
