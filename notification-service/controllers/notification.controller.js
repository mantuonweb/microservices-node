const logger = require('../utils/logger');
const notificationService = require('../lib/notification-manager');

class NotificationController {
  constructor() {
    this.clients = new Map(); // Store SSE clients
    this.isListening = false;
  }

  /**
   * Handle all notification-related requests
   */
  async handleNotifications(req, res) {
    // If it's a status request
    if (req.method === 'GET' && req.path.endsWith('/status')) {
      return res.status(200).json({
        success: true,
        isListening: this.isListening,
        status: this.isListening ? 'active' : 'inactive',
        connectedClients: this.clients.size
      });
    }

    // If it's an initialization request
    if (req.method === 'POST' && req.path.endsWith('/init')) {
      if (this.isListening) {
        return res.status(200).json({
          success: true,
          message: 'Notification service already initialized'
        });
      }

      try {
        // Connect to the notification service
        await notificationService.getInstance().connect();

        // Register handler for order.created event
        notificationService.getInstance().registerHandler('order.created', (notification) => {
          logger.info(`Order created notification received: ${JSON.stringify(notification.data)}`);
          const email = notification?.data?.customer?.email;
          if (email) {
            const client = this.clients.get(email);
            client.write(`data: ${JSON.stringify({
              event: 'order.created',
              data: notification.data,
              timestamp: new Date().toISOString()
            })}\n\n`);
          }
        });

        setInterval(() => {
          this.clients.forEach((client) => {
            client.write(`data: ${JSON.stringify({
              event: 'status',
              data: 'healthy',
              timestamp: new Date().toISOString()
            })}\n\n`);
          });
        }, 5000);

        // Start listening for events
        await notificationService.getInstance().startListening();
        this.isListening = true;
        logger.info('Notification service initialized successfully');

        return res.status(200).json({
          success: true,
          message: 'Notification service initialized successfully',
          sseEndpoint: '/api/notifications/events'
        });
      } catch (error) {
        logger.error(`Error initializing notification service: ${error.message}`);
        return res.status(500).json({
          success: false,
          message: 'Failed to initialize notification service'
        });
      }
    }

    // If it's an SSE connection request
    if (req.method === 'GET' && req.path.endsWith('/events')) {
      // Check if service is initialized
      if (!this.isListening) {
        return res.status(503).json({
          success: false,
          message: 'Notification service not initialized'
        });
      }

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.flushHeaders();
      const clientId = (req?.user?.email) ?? (new Date().getTime() + 'notifications');
      logger.info(`New SSE client connected: ${clientId}`);

      // Store client
      this.clients.set(clientId, res);

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        event: 'connection',
        message: 'Connected to notification service'
      })}\n\n`);

      // Handle client disconnection
      req.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`SSE client disconnected: ${clientId}`);
      });

      return; // Keep connection open
    }

    // If it's not a recognized request
    return res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });
  }
}

module.exports = NotificationController;
