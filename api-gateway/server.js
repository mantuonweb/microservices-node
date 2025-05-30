require('dotenv').config({ path: './api-gateway.env' });
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Consul = require('consul');
const logger = require('./utils/logger');
const cors = require('cors');
const os = require('os');

// Zipkin imports
const { Tracer, BatchRecorder, jsonEncoder: { JSON_V2 } } = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const { HttpLogger } = require('zipkin-transport-http');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

// Add these functions before the ApiGateway class definition
function createTracingProxy(tracer, options) {
  const { target, pathRewrite, ...otherOptions } = options;
  
  return createProxyMiddleware({
    target,
    pathRewrite,
    changeOrigin: true,
    ...otherOptions,
    onProxyReq: (proxyReq, req, res) => {
      // Add request ID
      proxyReq.setHeader('X-Gateway-Request-ID', Date.now().toString());
      // Forward all original headers
      Object.keys(req.headers).forEach(header => {
        proxyReq.setHeader(header, req.headers[header]);
      });
      
      // Check if Zipkin trace headers exist, if not create them
      if (!req.headers['x-b3-traceid']) {
        // Generate trace IDs in the correct format for Zipkin
        const { traceId, spanId } = generateZipkinIds();
        
        // Add the trace headers to both the proxy request and the original request
        proxyReq.setHeader('x-b3-traceid', traceId);
        proxyReq.setHeader('x-b3-spanid', spanId);
        proxyReq.setHeader('x-b3-sampled', '1');
        
        req.headers['x-b3-traceid'] = traceId;
        req.headers['x-b3-spanid'] = spanId;
        req.headers['x-b3-sampled'] = '1';
        
        logger.info(`Created new trace ID: ${traceId} for request to ${req.path}`);
      } else {
        // Ensure all existing Zipkin B3 headers are properly propagated
        const zipkinHeaders = [
          'x-b3-traceid',
          'x-b3-spanid',
          'x-b3-parentspanid',
          'x-b3-sampled',
          'x-b3-flags'
        ];
        
        zipkinHeaders.forEach(header => {
          if (req.headers[header]) {
            proxyReq.setHeader(header, req.headers[header]);
          }
        });
        console.log(req.headers, 'req.headers after')
        logger.info(`Propagating existing trace ID: ${req.headers['x-b3-traceid']} for request to ${req.path}`);
      }
      
      // Call the original onProxyReq if provided
      if (options.onProxyReq) {
        options.onProxyReq(proxyReq, req, res);
      }
    }
  });
}

// Generate Zipkin compatible trace and span IDs
function generateZipkinIds() {
  // Zipkin trace IDs are 16 or 32 hex characters (64 or 128 bits)
  // Span IDs are 16 hex characters (64 bits)
  
  // For compatibility with the format you showed, we'll use this approach:
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const randomPart = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16).padStart(12, '0');
  
  // Combine timestamp and random parts for a 24-character trace ID
  const traceId = timestamp + randomPart;
  
  // For span ID, use a different random value (16 chars)
  const spanId = Math.floor(Math.random() * 0xFFFFFFFFFFFFFFFF).toString(16).padStart(16, '0');
  
  return { traceId, spanId };
}

class ApiGateway {
  constructor() {
    this.app = express();
    this.PORT = process.env.PORT || 9000;
    this.SERVICE_NAME = 'api-gateway';
    this.serviceId = `${this.SERVICE_NAME}-${this.PORT}-${os.hostname()}`;

    // Initialize Zipkin
    this.initZipkin();

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
      },
      'notification-service': {
        path: '/api/notifications'
      },
      'query-service': {
        path: '/api/query'
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
      windowMs: 1 * 60 * 1000, // 1 minute
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

  initZipkin() {
    // Create a Zipkin tracer
    const zipkinUrl = process.env.ZIPKIN_URL || 'http://localhost:9411';
    const recorder = new BatchRecorder({
      logger: new HttpLogger({
        endpoint: `${zipkinUrl}/api/v2/spans`,
        jsonEncoder: JSON_V2
      })
    });

    const ctxImpl = new CLSContext('zipkin');
    this.tracer = new Tracer({ ctxImpl, recorder, localServiceName: this.SERVICE_NAME });
    
    // Add Zipkin middleware to express
    this.app.use(zipkinMiddleware({ tracer: this.tracer }));
    
    logger.info(`Zipkin tracing initialized with endpoint: ${zipkinUrl}`);
  }

  init() {
    // Initialize service registry and indices
    this.serviceRegistry = {};
    this.serviceIndices = {};

    this.supportedServices.forEach(service => {
      this.serviceRegistry[service] = [];
      this.serviceIndices[service] = 0;
    });

    // Enable CORS for all routes with no restrictions
    this.app.use(
      cors({
        origin: true, // Allow all origins
        methods: '*', // Allow all methods
        allowedHeaders: '*', // Allow all headers
        exposedHeaders: '*', // Expose all headers
        credentials: true, // Allow credentials
        maxAge: 86400, // Cache preflight requests for 24 hours
      })
    );

    // Add cookie-parser middleware
    const cookieParser = require('cookie-parser');
    this.app.use(cookieParser());

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
        this.proxyCache[cacheKey] = createTracingProxy(this.tracer, {
          target,
          pathRewrite: {
            [`^${pathPrefix}`]: pathPrefix,
          },
          cookieDomainRewrite: {
            '*': '', // This rewrites cookie domains from the target to the current domain
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

    // Add catch-all route for non-intercepted services
    this.app.use('*', (req, res) => {
      logger.warn(`Attempted to access non-existent route: ${req.originalUrl}`);
      res.status(404).json({
        error: 'Service not found',
        message: `The requested endpoint '${req.originalUrl}' does not exist or is not configured in the API Gateway.`,
        availableServices: this.supportedServices.map(service => this.serviceConfig[service].path)
      });
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

  start() {
    // Set up proxy routes before server starts to avoid race conditions
    this.setupProxyRoutes();
    
    const serviceHost = os.hostname() || 'localhost';
    const serviceDetails = {
      id: this.serviceId,
      name: this.SERVICE_NAME,
      address: serviceHost,
      port: parseInt(this.PORT),
      tags: ['gateway', 'api', 'entry-point'],
      check: {
        http: `http://${serviceHost}:${this.PORT}/health`,
        interval: '15s',
        timeout: '5s',
      },
    };

    // Define the deregistration handler once
    const handleShutdownSignal = () => {
      this.consul.agent.service.deregister(this.serviceId)
        .then(() => {
          logger.info(`Service deregistered from Consul: ${this.serviceId}`);
          process.exit(0);
        })
        .catch((err) => {
          logger.error(`Failed to deregister service from Consul: ${err.message}`);
          process.exit(1);
        });
    };

    // Register signal handlers once
    process.on('SIGTERM', handleShutdownSignal);
    process.on('SIGINT', handleShutdownSignal);

    // Start the server and store the server instance
    this.server = this.app.listen(this.PORT, async () => {
      logger.info(`API Gateway running on http://localhost:${this.PORT}`);
      
      try {
        await this.consul.agent.service.register(serviceDetails);
        logger.info(`Service registered with Consul: ${this.serviceId}`);
      } catch (err) {
        logger.error(`Failed to register service with Consul: ${err.message}`);
      }
    });

    // Return the server instance for testing purposes
    return this.server;
  }
}

// Create and start the API Gateway
const gateway = new ApiGateway();
gateway.start();
