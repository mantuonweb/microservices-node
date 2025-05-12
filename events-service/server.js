const BaseService = require('./lib/BaseService');
const configureApp = require('./config/App');
const logger = require('./utils/logger');

class EventService extends BaseService {
  constructor() {
    super({
      serviceName: 'event-service',
      tags: ['microservice', 'event']
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
new EventService().initialize().catch((error) => {
  logger.error('Failed to initialize Auth Service:', error);
  process.exit(1);
});

module.exports = EventService;