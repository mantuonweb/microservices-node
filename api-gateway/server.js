require('dotenv').config({ path: './api-gateway.env' });
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Consul = require('consul');
const logger = require('./utils/logger');
const axios = require('axios');
class ApiGateway {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 9000;

    // Service configuration object
    this.serviceConfig = {
      'product-service': {
        path: '/api/products'
      },
      'order-service': {
        path: '/api/orders'
      },
      'customer-service': {
        path: '/api/customers'
      },
      'inventory-service': {
        path: '/api/inventories'
      },
      'payment-service': {
        path: '/api/payments'
      },
      'auth-service': {
        path: '/api/auth'
      }
    };

    // Derive the arrays/objects as needed
    this.supportedServices = Object.keys(this.serviceConfig);

    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || '8500',
      promisify: true,
    });

    // Rate limiting
    this.apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Cache for proxy instances
    this.proxyCache = {};

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    this.init();
  }

  init() {
    // Initialize service registry and indices
    this.serviceRegistry = {};
    this.serviceIndices = {};

    this.supportedServices.forEach(service => {
      this.serviceRegistry[service] = [];
      this.serviceIndices[service] = 0;
    });

    // Add request logging middleware
    this.setupLoggingMiddleware();

    this.setupHealthEndpoint();
    this.discoverServices();
    this.setupServiceDiscoveryInterval();
  }

  setupLoggingMiddleware() {
    this.app.use((req, res, next) => {
      const start = Date.now();

      // Capture response data
      const originalEnd = res.end;
      res.end = function (...args) {
        const duration = Date.now() - start;
        logger.info({
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`
        });

        // Call the original end method
        return originalEnd.apply(this, args);
      };

      next();
    });
  }

  shutdown() {
    logger.info('Received shutdown signal, closing server gracefully...');

    // Clear the service discovery interval if it exists
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      logger.info('Service discovery interval cleared');
    }

    // Close the HTTP server
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');

        // Close any other resources (database connections, etc.)

        // Exit process after cleanup
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Set a timeout to force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000); // 10 seconds timeout
    } else {
      logger.info('No server to close');
      process.exit(0);
    }
  }

  setupHealthEndpoint() {
    this.app.get('/health', (req, res) => {
      const serviceStatus = {};
      this.supportedServices.forEach(service => {
        serviceStatus[service] = this.serviceRegistry[service].length;
      });

      res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: Date.now(),
        services: serviceStatus
      });
    });
  }

  setupServiceDiscoveryInterval() {
    // Store the interval ID so we can clear it during shutdown
    this.discoveryInterval = setInterval(() => this.discoverServices(), 30000);
  }

  // Middleware to check if service is available
  checkServiceAvailability(serviceName) {
    return (req, res, next) => {
      if (!this.serviceRegistry[serviceName]?.length) {
        return res
          .status(503)
          .json({ error: `Service ${serviceName} is currently unavailable` });
      }
      next();
    };
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

  // Create a proxy handler for a service
  createProxyHandler(serviceName, pathPrefix) {
    return (req, res, next) => {
      const target = this.getNextServiceInstance(serviceName);
      if (!target) {
        return res.status(503).json({ error: `${serviceName} unavailable` });
      }

      logger.info(`Routing to ${serviceName} instance: ${target}`);

      // Use cached proxy or create new one
      const cacheKey = `${serviceName}-${target}`;
      if (!this.proxyCache[cacheKey]) {
        this.proxyCache[cacheKey] = createProxyMiddleware({
          target,
          changeOrigin: true,
          pathRewrite: {
            [`^${pathPrefix}`]: pathPrefix,
          },
          onProxyReq: (proxyReq, req, res) => {
            // Add request ID
            proxyReq.setHeader('X-Gateway-Request-ID', Date.now().toString());
            
            // Forward all original headers
            Object.keys(req.headers).forEach(header => {
              proxyReq.setHeader(header, req.headers[header]);
            });
          },
          onError: (err, req, res) => {
            res.status(500).json({ error: `Service ${serviceName} error: ${err.message}` });
          }
        });
      }

      return this.proxyCache[cacheKey](req, res, next);
    };
  }

  // Define proxy routes
  setupProxyRoutes() {
    // Apply authentication middleware globally
    this.app.use(this.authenticateRequest());

    // Set up routes for each service using the config
    this.supportedServices.forEach(service => {
      const path = this.serviceConfig[service].path;

      this.app.use(
        path,
        this.checkServiceAvailability(service),
        this.apiLimiter,
        this.createProxyHandler(service, path)
      );
    });
  }

  async discoverServices() {
    try {
      // Get services from Consul
      const services = await this.consul.catalog.service.list();

      // Process only supported services
      const discoveryPromises = this.supportedServices
        .filter(service => services[service])
        .map(async (serviceName) => {
          try {
            const serviceDetails = await this.consul.catalog.service.nodes(serviceName);
            if (serviceDetails?.length) {
              // Create new instances array
              const newInstances = serviceDetails.map(
                service => `http://${service.ServiceAddress}:${service.ServicePort}`
              );

              // Only update if instances have changed
              const currentInstances = JSON.stringify(this.serviceRegistry[serviceName]);
              const updatedInstances = JSON.stringify(newInstances);

              if (currentInstances !== updatedInstances) {
                this.serviceRegistry[serviceName] = newInstances;
                logger.info(`Updated ${serviceDetails.length} instances of ${serviceName}`);
              }
            } else if (this.serviceRegistry[serviceName].length > 0) {
              // Service has no instances but we had some before
              logger.warn(`Service ${serviceName} has no instances available`);
              this.serviceRegistry[serviceName] = [];
            }
          } catch (error) {
            logger.error(`Error discovering service ${serviceName}:`, error);
          }
        });

      await Promise.all(discoveryPromises);
    } catch (error) {
      logger.error('Error discovering services:', error);
    }
  }

  authenticateRequest() {
    return async (req, res, next) => {
      // Skip authentication for the auth service itself and health endpoint
      if (req.path.startsWith('/api/auth') || req.path === '/health') {
        return next();
      }

      try {
        // Get auth service instance
        const authServiceInstance = this.getNextServiceInstance('auth-service');
        if (!authServiceInstance) {
          return res.status(503).json({ error: 'Authentication service unavailable' });
        }

        // Get the token from the request headers
        const token = req.headers.authorization;
        if (!token) {
          return res.status(401).json({ error: 'No authorization token provided' });
        }
        console.log('Token:', token, `${authServiceInstance}/api/auth/profile`);
        // Forward the token to the auth service for validation using axios
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
        req.user = response.data;
        
        next();
      } catch (error) {
        logger.error('Authentication error:', error.message);
        
        // Handle different types of errors
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          return res.status(error.response.status).json({ 
            error: error.response.data.error || 'Authentication failed' 
          });
        } else if (error.request) {
          // The request was made but no response was received
          return res.status(503).json({ error: 'Authentication service not responding' });
        } else {
          // Something happened in setting up the request
          return res.status(500).json({ error: 'Authentication failed' });
        }
      }
    };
  }

  start() {
    // Start the server and store the server instance
    this.server = this.app.listen(this.PORT, () => {
      logger.info(`API Gateway running on http://localhost:${this.PORT}`);
      // Set up proxy routes after server starts
      this.setupProxyRoutes();
    });

    // Return the server instance for testing purposes
    return this.server;
  }
}

// Create and start the API Gateway
const gateway = new ApiGateway();
gateway.start();
