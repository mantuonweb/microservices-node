const Consul = require('consul');
const logger = require('./logger');

let consul = null;
const CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';

if (CONSUL_ENABLED) {
  try {
    consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || 8500,
    });
  } catch (error) {
    logger.error('Failed to initialize Consul client:', error.message);
  }
}

/**
 * Discover a service by name
 * @param {string} serviceName - The name of the service to discover
 * @param {string} defaultUrl - Default URL to use if service discovery fails
 * @returns {Promise<Array>} - Array of service instances
 */
async function discoverService(serviceName, defaultUrl = null) {
  // If Consul is not available or disabled, return default if provided
  if (!consul || !CONSUL_ENABLED) {
    logger.warn(`Consul not available, using default URL for ${serviceName}`);
    return defaultUrl
      ? [
          {
            ServiceAddress: defaultUrl.split(':')[0] || 'localhost',
            ServicePort: defaultUrl.split(':')[1] || '80',
          },
        ]
      : [];
  }

  return new Promise((resolve, reject) => {
    consul.catalog.service.nodes(serviceName, (err, result) => {
      if (err) {
        logger.error(`Error discovering service ${serviceName}:`, err);
        // Return default if provided
        if (defaultUrl) {
          logger.info(`Using default URL for ${serviceName}: ${defaultUrl}`);
          return resolve([
            {
              ServiceAddress: defaultUrl.split(':')[0] || 'localhost',
              ServicePort: defaultUrl.split(':')[1] || '80',
            },
          ]);
        }
        return reject(err);
      }

      if (!result || result.length === 0) {
        logger.warn(`No instances found for service: ${serviceName}`);
        // Return default if provided
        if (defaultUrl) {
          logger.info(`Using default URL for ${serviceName}: ${defaultUrl}`);
          return resolve([
            {
              ServiceAddress: defaultUrl.split(':')[0] || 'localhost',
              ServicePort: defaultUrl.split(':')[1] || '80',
            },
          ]);
        }
        return resolve([]);
      }

      logger.info(`Discovered ${result.length} instances of ${serviceName}`);
      resolve(result);
    });
  });
}

module.exports = {
  discoverService,
};
