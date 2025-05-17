const BaseService = require('./lib/BaseService');
const configureApp = require('./config/app');
const logger = require('./utils/logger');

class CustomerService extends BaseService {
  constructor() {
    super({
      serviceName: 'customer-service',
      tags: ['microservice', 'customer']
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