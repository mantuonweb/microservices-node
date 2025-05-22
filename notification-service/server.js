const BaseService = require('./lib/BaseService');
const configureApp = require('./config/application');
const logger = require('./utils/logger');

class NotificationService extends BaseService {
  constructor() {
    super({
      serviceName: 'notification-service',
      tags: ['microservice', 'notification']
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
new NotificationService().initialize().catch((error) => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});

module.exports = NotificationService;

