const BaseService = require('./lib/BaseService');
const configureApp = require('./config/App');
const logger = require('./utils/logger');

class CustomerService extends BaseService {
  constructor() {
    super({
      serviceName: 'payment-service',
      tags: ['microservice', 'payment']
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
new CustomerService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = CustomerService;