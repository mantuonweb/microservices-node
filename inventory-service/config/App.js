const express = require('express');
const cors = require('cors');
const inventoryRoutes = require('../routes/inventory.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');
const rabbitMQClient = require('../utils/RabbitMQClient');
const { listenProductUpdates } = require('../listeners/productEventListener');

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3006;
  // Configure middleware
  app.use(express.json());
  app.use(cors());
  // Initialize MongoDB connection
  mongoClient.connect();

  // Initialize RabbitMQ connection - without using Promise chaining
  try {
    rabbitMQClient.connect();
  } catch (err) {
    logger.error('Failed to initialize RabbitMQ:', err);
  }

  // Configure routes
  app.use('/api/inventories', inventoryRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Inventory Service' });
  });

  listenProductUpdates();

  return { app, PORT };
};
module.exports = configureApp;
