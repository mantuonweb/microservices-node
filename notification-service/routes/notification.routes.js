const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const notificationController = new NotificationController();

// Route to check notification service status
router.get('/status', notificationController.handleNotifications.bind(notificationController));
router.get('/events', notificationController.handleNotifications.bind(notificationController));
router.post('/init', notificationController.handleNotifications.bind(notificationController));


// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
