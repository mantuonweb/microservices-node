const BaseService = require('./lib/BaseService');
const configureApp = require('./config/application');
const logger = require('./utils/logger');

class AuthService extends BaseService {
  constructor() {
    super({
      serviceName: 'auth-service',
      tags: ['microservice', 'auth']
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
new AuthService().initialize().catch((error) => {
  logger.error('Failed to initialize Auth Service:', error);
  process.exit(1);
});

module.exports = AuthService;