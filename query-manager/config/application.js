const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const queryRoutes = require('../routes/query.routes');
const AuthMiddleware = require('../middleware/auth.middleware');
const RedisClient = require('../lib/RedisClient');
const notificationService = require('../lib/notification-manager');
const ZipkinHelper = require('../utils/ZipkinHelper');
const SERVICE_NAME = 'query-service';
const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3001;

  // Configure middleware
  app.use(express.json());
  app.use(cors());
  app.use(actuator('/management'));
  app.use(new AuthMiddleware().authenticate());
  try {
    const redisClient = RedisClient.getInstance();
    // Initialize Redis client
    redisClient.connect();
  } catch (error) {
    console.error('Error initializing Redis client:', error);
  }
  manageNotifications();
  // Initialize Zipkin using the helper class
  const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
  zipkinHelper.initialize(app);
  // Configure routes
  app.use('/api/query', queryRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Query Service' });
  });

  return { app, PORT };
};
module.exports = configureApp;
async function manageNotifications() {
  try {
    // Connect to the notification service
    await notificationService.getInstance().connect();
    // Register handler for order.created event
    notificationService.getInstance().registerHandler('order.created', async (notification) => {
      const email = notification?.data?.customer?.email
      console.log(`Order created notification received: ${email}`);
      const cacheKey = `orderbyemail:${email}`;
      try {
        await RedisClient.getInstance().deleteJSON(cacheKey);
      } catch (cacheError) {
        console.log('Cache prune error:', cacheError);
      }
    });
    await notificationService.getInstance().startListening();
  } catch (error) {
    logger.error(`Error initializing notification service: ${error.message}`);
  }
}