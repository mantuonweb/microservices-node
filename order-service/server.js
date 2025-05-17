const BaseService = require('./lib/BaseService');
const configureApp = require('./config/application');
const logger = require('./utils/logger');

class OrderService extends BaseService {
  constructor() {
    super({
      serviceName: 'order-service',
      tags: ['microservice', 'order']
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
new OrderService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = OrderService;