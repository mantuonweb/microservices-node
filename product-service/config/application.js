const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const productRoutes = require('../routes/product.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const SERVICE_NAME = 'product-service';

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Configure middleware
  app.use(express.json());
  app.use(cors());
  app.use(actuator('/management'));
  app.use(new AuthMiddleware().authenticate());

  // Initialize MongoDB connection
  mongoClient.getInstance().connect();
  // Initialize Zipkin using the helper class
  const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
  zipkinHelper.initialize(app);
  // Configure routes
  app.use('/api/products', productRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Product Service' });
  });

  return { app, PORT };
};
module.exports = configureApp;
