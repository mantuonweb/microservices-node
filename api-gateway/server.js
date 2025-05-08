require('dotenv').config({ path: './api-gateway.env' });
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Consul = require('consul');

const app = express();
const PORT = process.env.PORT || 3000;

// Store multiple instances for each service
let serviceRegistry = {
  'product-service': [],
  'order-service': [],
  'customer-service': [],
  'inventory-service': [],
};

// Keep track of the current instance index for round-robin load balancing
const serviceIndices = {
  'product-service': 0,
  'order-service': 0,
  'customer-service': 0,
  'inventory-service': 0,
};

const consul = new Consul({
  host: process.env.CONSUL_HOST || 'localhost',
  port: process.env.CONSUL_PORT || '8500',
  promisify: true,
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to check if service is available
const checkServiceAvailability = (serviceName) => {
  return (req, res, next) => {
    if (
      !serviceRegistry[serviceName] ||
      serviceRegistry[serviceName].length === 0
    ) {
      return res
        .status(503)
        .json({ error: `Service ${serviceName} is currently unavailable` });
    }
    next();
  };
};

// Simple round-robin load balancer
function getNextServiceInstance(serviceName) {
  const instances = serviceRegistry[serviceName];
  if (!instances || instances.length === 0) {
    return null;
  }

  // Get the next instance in round-robin fashion
  const index = serviceIndices[serviceName] % instances.length;
  serviceIndices[serviceName] =
    (serviceIndices[serviceName] + 1) % instances.length;

  return instances[index];
}

// Discover services initially
discoverServices();

// Set up periodic service discovery (every 30 seconds)
setInterval(discoverServices, 30000);

// Define proxy routes
function setupProxyRoutes() {
  // Product service proxy
  app.use(
    '/api/products',
    checkServiceAvailability('product-service'),
    apiLimiter,
    (req, res, next) => {
      const target = getNextServiceInstance('product-service');
      if (!target) {
        return res.status(503).json({ error: 'Product service unavailable' });
      }

      console.log(`Routing to product-service instance: ${target}`);

      // Create a new proxy for each request with the current target
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: {
          '^/api/products': '/api/products',
        },
      });

      return proxy(req, res, next);
    }
  );

  // Order service proxy
  app.use(
    '/api/orders',
    checkServiceAvailability('order-service'),
    apiLimiter,
    (req, res, next) => {
      const target = getNextServiceInstance('order-service');
      if (!target) {
        return res.status(503).json({ error: 'Order service unavailable' });
      }

      console.log(`Routing to order-service instance: ${target}`);

      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: {
          '^/api/orders': '/api/orders',
        },
      });

      return proxy(req, res, next);
    }
  );

  // Customer service proxy
  app.use(
    '/api/customers',
    checkServiceAvailability('customer-service'),
    apiLimiter,
    (req, res, next) => {
      const target = getNextServiceInstance('customer-service');
      if (!target) {
        return res.status(503).json({ error: 'Customer service unavailable' });
      }

      console.log(`Routing to customer-service instance: ${target}`);

      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: {
          '^/api/customers': '/api/customers',
        },
      });

      return proxy(req, res, next);
    }
  );
}

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    services: {
      'product-service': serviceRegistry['product-service'].length,
      'order-service': serviceRegistry['order-service'].length,
      'customer-service': serviceRegistry['customer-service'].length,
      'inventory-service': serviceRegistry['inventory-service'].length,
    },
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
  // Set up proxy routes after server starts
  setupProxyRoutes();
});

async function discoverServices() {
  try {
    // Get services from Consul
    const services = await consul.catalog.service.list();

    // Reset service registry for clean update
    for (const serviceName in serviceRegistry) {
      serviceRegistry[serviceName] = [];
    }

    // Update service registry with all instances
    for (const serviceName in services) {
      if (
        serviceName === 'product-service' ||
        serviceName === 'order-service' ||
        serviceName === 'customer-service' ||
        serviceName === 'inventory-service'
      ) {
        const serviceDetails = await consul.catalog.service.nodes(serviceName);
        if (serviceDetails && serviceDetails.length > 0) {
          // Add all instances to the registry
          serviceRegistry[serviceName] = serviceDetails.map(
            (service) =>
              `http://${service.ServiceAddress}:${service.ServicePort}`
          );

          console.log(
            `Discovered ${serviceDetails.length} instances of ${serviceName}`
          );
        }
      }
    }

    console.log('Service registry updated:', serviceRegistry);
  } catch (error) {
    console.error('Error discovering services:', error);
  }
}
