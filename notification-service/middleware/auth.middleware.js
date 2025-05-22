const axios = require('axios');
const logger = require('../utils/logger');
const Consul = require('consul');
class AuthMiddleware {
  constructor() {
    this.eventServiceUrl = {};
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || 8500,
      promisify: true,
    });
  }

  // Simple round-robin load balancer
  async getAuthServiceInstance() {
    const env = process.env.NODE_ENV || 'local'
    const serviceId = 'auth-service';
    try {
      // Try to get the service details from Consul using service ID
      const services = await this.consul.catalog.service.nodes(serviceId);
      if (services && services.length > 0) {
        const service = services[0];
        // Construct URL from service address and port
        this.eventServiceUrl[
          serviceId
        ] =  env ==='local'? `http://localhost:${service.ServicePort}`: `http://${service.ServiceAddress}:${service.ServicePort}`;
        logger.info(
          `Retrieved event service URL from Consul: ${this.eventServiceUrl[serviceId]}`
        );
        return this.eventServiceUrl?.[serviceId];
      }
    } catch (error) {
      logger.warn(
        `Failed to retrieve event service from Consul: ${error.message}`
      );
    }
  }

  authenticate() {
    // Skip authentication for the auth service itself and health endpoint
    return async (req, res, next) => {
      if (req.path === '/health') {
        return next();
      }
      logger.info(`Authentication request for path: ${req.path}, method: ${req.method}`);
      try {
        let token = req.headers.authorization;
        // Get auth service instance
        logger.debug('Attempting to get auth service instance');
        console.log(`Authorization header ${token ? 'present' : 'not present'}`);
        const authServiceInstance = await this.getAuthServiceInstance();
        logger.debug('authServiceInstance: ', authServiceInstance);
        if (!authServiceInstance) {
          logger.error('No auth service instances available');
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        logger.debug(`Selected auth service instance: ${authServiceInstance}`);

        // Get the token from the request headers

        logger.info(`Authorization header ${token ? 'present' : 'not present'}`);

        // If no token in headers but cookies exist, check for auth cookie
        // Note: We need cookie-parser middleware for this to work
        if (!token && req.cookies && req.cookies.auth_token) {
          logger.debug('No token in headers, found token in cookies');
          token = `Bearer ${req.cookies.auth_token}`;
          // Add the token to headers so it gets forwarded to services
          req.headers.authorization = token;
        }

        if (!token) {
          logger.warn('Authentication failed: No token provided');
          return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Forward the token to the auth service for validation using axios
        logger.debug(`Validating token with auth service at ${authServiceInstance}/api/auth/profile`);
        const response = await axios({
          method: 'get',
          url: `${authServiceInstance}/api/auth/profile`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          timeout: 5000 // 5 second timeout
        });

        // If validation successful, add user info to request
        req.user = response?.data?.user;
        logger.info(`Authentication successful for user: ${response.data.user.username || response.data.user.email || 'unknown'}`);

        next();
      } catch (error) {
        logger.error('Authentication error:', error.message);

        // Log the full error for debugging in development
        logger.debug('Authentication error details:', error);

        // Handle different types of errors
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logger.warn(`Auth service responded with error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
          return res.status(error.response.status).json({
            error: error.response.data.error || 'Authentication failed'
          });
        } else if (error.request) {
          // The request was made but no response was received
          logger.error('Auth service timeout or connection error');
          return res.status(503).json({ error: 'Authentication service not responding' });
        } else {
          // Something happened in setting up the request
          logger.error('Unexpected authentication error:', error.message);
          return res.status(500).json({ error: 'Authentication failed' });
        }
      }
    };
  }
}

module.exports = AuthMiddleware;