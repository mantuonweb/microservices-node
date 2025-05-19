const express = require('express');
const cors = require('cors');
const inventoryRoutes = require('../routes/inventory.routes');
const productRoutes = require('../routes/product.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3006;
  // Configure middleware
  app.use(express.json());
  app.use(cors());
  app.use(new AuthMiddleware().authenticate());
  // Initialize MongoDB connection
  mongoClient.getInstance().connect();

  // Configure routes
  app.use('/api/inventories', inventoryRoutes);
  app.use('/api/inventories/products', productRoutes);
  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Inventory Service' });
  });
  return { app, PORT };
};
module.exports = configureApp;
