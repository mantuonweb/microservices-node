require('dotenv').config({ path: './customer-service.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Consul = require('consul');
const customerRoutes = require('./routes/customer.routes');
const logger = require('./utils/logger');
const app = express();
const PORT = process.env.PORT || 3002;
const SERVICE_NAME = 'customer-service';
const SERVICE_ID = `${SERVICE_NAME}-${PORT}`;

// Initialize Consul client if enabled
let consul = null;
const CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';

if (CONSUL_ENABLED) {
  try {
    consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || 8500,
      promisify: true,
    });
    logger.info('Consul client initialized');
  } catch (error) {
    logger.error('Failed to initialize Consul client:', error.message);
  }
} else {
  logger.info('Consul integration disabled by configuration');
}

app.use(express.json());
app.use(cors());
const MONGODB_URI = process.env.MONGODB_URL 
// MongoDB connection
mongoose.set('strictQuery', false);
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB Connection Events
mongoose.connection.on('connected', () => {
  logger.info('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

app.use('/api/customers', customerRoutes);
// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'Customer Service' });
});

// Register service with Consul
function registerService() {
  try {
    consul.agent.service.register(
      {
        id: SERVICE_ID,
        name: SERVICE_NAME,
        address: process.env.SERVICE_HOST || 'localhost',
        port: parseInt(PORT),
        tags: ['microservice', 'customer'],
        check: {
          http: `http://${
            process.env.SERVICE_HOST || 'localhost'
          }:${PORT}/health`,
          interval: '15s',
          timeout: '5s',
        },
      },
      (err) => {
        if (err) {
          logger.error('Failed to register service with Consul:', err);
          return;
        }
        logger.info(`Service registered with Consul: ${SERVICE_ID}`);
      }
    );
  } catch (error) {
    logger.error('Error connecting to Consul:', error.message);
    logger.info('Service will run without Consul registration');
  }
}

// Deregister service from Consul
function deregisterService() {
  if (!consul || !CONSUL_ENABLED) {
    return;
  }

  consul.agent.service.deregister(SERVICE_ID, (err) => {
    if (err) {
      logger.error('Failed to deregister service from Consul:', err);
      return;
    }
    logger.info(`Service deregistered from Consul: ${SERVICE_ID}`);
  });
}

// Start Server
const server = app.listen(PORT, () => {
  logger.info(`Customer Service running on port ${PORT}`);
  registerService();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: shutting down...');
  deregisterService();
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: shutting down...');
  deregisterService();
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});
