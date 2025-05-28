const axios = require('axios');
const logger = require('../utils/logger');

class AuthMiddleware {
  constructor(serviceRegistry, serviceIndices) {
    this.serviceRegistry = serviceRegistry;
    this.serviceIndices = serviceIndices;
  }

  // Simple round-robin load balancer
  getNextServiceInstance(serviceName) {
    const instances = this.serviceRegistry[serviceName];
    if (!instances?.length) return null;

    // Get the next instance in round-robin fashion
    const index = this.serviceIndices[serviceName] % instances.length;
    this.serviceIndices[serviceName] = (this.serviceIndices[serviceName] + 1) % instances.length;

    return instances[index];
  }

  authenticate() {
    return async (req, res, next) => {
      logger.info(`Authentication request for path: ${req.path}, method: ${req.method}`);
    
      // Skip authentication for the auth service itself and health endpoint
      if (req.path.startsWith('/api/auth') || req.path === '/health' || req.path.startsWith('/management') ) {
        logger.info(`Skipping authentication for public path: ${req.path}`);
        return next();
      }

      try {
        // Get auth service instance
        logger.debug('Attempting to get auth service instance');
        const authServiceInstance = this.getNextServiceInstance('auth-service');
        if (!authServiceInstance) {
          logger.error('No auth service instances available');
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }
        logger.debug(`Selected auth service instance: ${authServiceInstance}`);

        // Get the token from the request headers
        let token = req.headers.authorization;
        logger.debug(`Authorization header ${token ? 'present' : 'not present'}`);

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
        logger.info(`Authentication successful for user: ${response.data.username || response.data.email || 'unknown'}`);
        req.user = response.data;

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