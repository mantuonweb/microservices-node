const BaseService = require('./lib/BaseService');
const configureApp = require('./config/application');
const logger = require('./utils/logger');

class ProductService extends BaseService {
  constructor() {
    super({
      serviceName: 'product-service',
      tags: ['microservice', 'product']
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
new ProductService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = ProductService;
