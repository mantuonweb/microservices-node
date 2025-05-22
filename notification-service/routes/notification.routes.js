const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification.controller');
const notificationController = new NotificationController();

// Route to manually start/restart notification listeners
router.post('/setup', notificationController.setupNotificationListeners.bind(notificationController));

// Route to check notification service status
router.get('/status', notificationController.getStatus.bind(notificationController));


// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
