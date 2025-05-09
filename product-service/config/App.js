const express = require('express');
const cors = require('cors');
const productRoutes = require('../routes/product.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');
const rabbitMQClient = require('../utils/RabbitMQClient');

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Configure middleware
  app.use(express.json());
  app.use(cors());

  // Initialize MongoDB connection
  mongoClient.getInstance().connect();

  // Initialize RabbitMQ connection - without using Promise chaining
  try {
    rabbitMQClient.getInstance().connect();
  } catch (err) {
    logger.error('Failed to initialize RabbitMQ:', err);
  }

  // Configure routes
  app.use('/api/products', productRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Product Service' });
  });

  return { app, PORT };
};
module.exports = configureApp;
