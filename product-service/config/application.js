const express = require('express');
const cors = require('cors');
const productRoutes = require('../routes/product.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Configure middleware
  app.use(express.json());
  app.use(cors());
  app.use(new AuthMiddleware().authenticate());

  // Initialize MongoDB connection
  mongoClient.getInstance().connect();
  // Configure routes
  app.use('/api/products', productRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Product Service' });
  });

  return { app, PORT };
};
module.exports = configureApp;
