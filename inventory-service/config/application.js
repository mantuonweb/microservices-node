const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const inventoryRoutes = require('../routes/inventory.routes');
const productRoutes = require('../routes/product.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const NotificationHandler = require('../utils/NotificationHandler');
const SERVICE_NAME = 'inventory-service';

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3006;
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
  
  // Initialize notification handler
  const notificationHandler = new NotificationHandler();
  notificationHandler.initialize();
  
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
