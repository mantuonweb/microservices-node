require('dotenv').config({ path: './api-gateway.env' });
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Consul = require('consul');

class ApiGateway {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 3000;

    // Define supported services
    this.supportedServices = [
      'product-service',
      'order-service',
      'customer-service',
      'inventory-service'
    ];

    // Initialize service registry and indices
    this.serviceRegistry = {};
    this.serviceIndices = {};

    this.supportedServices.forEach(service => {
      this.serviceRegistry[service] = [];
      this.serviceIndices[service] = 0;
    });

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

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    this.init();
  }

  init() {
    this.setupHealthEndpoint();
    this.discoverServices();
    this.setupServiceDiscoveryInterval();
  }
  shutdown() {
    console.log('Received shutdown signal, closing server gracefully...');

    // Clear the service discovery interval if it exists
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      console.log('Service discovery interval cleared');
    }

    // Close the HTTP server
    if (this.server) {
      this.server.close(() => {
        console.log('HTTP server closed');

        // Close any other resources (database connections, etc.)

        // Exit process after cleanup
        console.log('Graceful shutdown completed');
        process.exit(0);
      });

      // Set a timeout to force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000); // 10 seconds timeout
    } else {
      console.log('No server to close');
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

      console.log(`Routing to ${serviceName} instance: ${target}`);

      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: {
          [`^${pathPrefix}`]: pathPrefix,
        },
      });

      return proxy(req, res, next);
    };
  }

  // Define proxy routes
  setupProxyRoutes() {
    // Map of service routes
    const serviceRoutes = {
      'product-service': '/api/products',
      'order-service': '/api/orders',
      'customer-service': '/api/customers',
      'inventory-service': '/api/inventories'
    };

    // Set up routes for each service
    Object.entries(serviceRoutes).forEach(([service, path]) => {
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

      // Reset service registry for clean update
      this.supportedServices.forEach(service => {
        this.serviceRegistry[service] = [];
      });

      // Process only supported services
      const discoveryPromises = this.supportedServices
        .filter(service => services[service])
        .map(async (serviceName) => {
          const serviceDetails = await this.consul.catalog.service.nodes(serviceName);
          if (serviceDetails?.length) {
            // Add all instances to the registry
            this.serviceRegistry[serviceName] = serviceDetails.map(
              service => `http://${service.ServiceAddress}:${service.ServicePort}`
            );

            console.log(`Discovered ${serviceDetails.length} instances of ${serviceName}`);
          }
        });

      await Promise.all(discoveryPromises);
      console.log('Service registry updated');
    } catch (error) {
      console.error('Error discovering services:', error);
    }
  }

  start() {
    // Start the server and store the server instance
    this.server = this.app.listen(this.PORT, () => {
      console.log(`API Gateway running on http://localhost:${this.PORT}`);
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
