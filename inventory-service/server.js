const BaseService = require('./lib/BaseService');
const configureApp = require('./config/app');
const logger = require('./utils/logger');

class InventoryService extends BaseService {
  constructor() {
    super({
      serviceName: 'inventory-service',
      tags: ['microservice', 'inventory']
    });
  }

  /**
   * Configure the application
   */
  configureApp() {
    return configureApp();
  }
}

// Create and start the service
new InventoryService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = InventoryService;

