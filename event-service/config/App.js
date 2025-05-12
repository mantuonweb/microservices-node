const express = require('express');
const cors = require('cors');
const eventRoutes = require('../routes/events.routes');

const configureApp = () => {
  const app = express();
  const PORT = process.env.PORT || 3009;
  // Configure middleware
  app.use(express.json());
  app.use(cors());
  // Configure routes
  app.use('/api/events', eventRoutes);

  // Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'Events Service' });
  });

  return { app, PORT };
};
module.exports = configureApp;
