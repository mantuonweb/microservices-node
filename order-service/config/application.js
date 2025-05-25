const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const orderRoutes = require('../routes/order.routes');
const customerRoutes = require('../routes/customer.routes');
const productRoutes = require('../routes/product.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const SERVICE_NAME = 'order-service';
const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3003;
  console.log(process.env.PORT, 'process.env.PORT');
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
  app.use('/api/orders', orderRoutes);
  app.use('/api/orders/customers', customerRoutes);
  app.use('/api/orders/products', productRoutes);
  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Order Service' });
  });
  return { app, PORT };
};
module.exports = configureApp;
