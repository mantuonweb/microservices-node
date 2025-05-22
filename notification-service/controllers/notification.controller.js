const logger = require('../utils/logger');
const notificationService = require('../lib/notification-manager');
const WebSocket = require('ws');

class NotificationController {
  constructor() {
    this.isListening = false;
    this.clients = new Map(); // Store WebSocket clients and their subscriptions
    this.wss = null;
  }

  /**
   * Get status of notification service
   */
  async getStatus(req, res) {
    return res.status(200).json({
      success: true,
      isListening: this.isListening,
      status: this.isListening ? 'active' : 'inactive',
      connectedClients: this.clients.size
    });
  }

  // ===== EVENT HANDLING =====

  /**
   * Set up notification listeners for events
   */
  async setupNotificationListeners(req, res) {
    if (this.isListening) {
      return res && res.status(200).json({
        success: true,
        message: 'Notification listeners already active'
      });
    }
    this.setupWebSocketServer();
    try {
      // Connect to the notification service
      await notificationService.getInstance().connect();

      // Register handlers for events
      this._registerEventHandlers();

      // Start listening for events
      await notificationService.getInstance().startListening();
      this.isListening = true;
      logger.info('Notification listeners set up successfully');

      if (res) {
        return res.status(200).json({
          success: true,
          message: 'Notification listeners set up successfully'
        });
      }
    } catch (error) {
      logger.error(`Error setting up notification listeners: ${error.message}`);
      if (res) {
        return res.status(500).json({
          success: false,
          message: 'Failed to set up notification listeners'
        });
      }
      throw error;
    }

  }

  /**
   * Register handlers for different event types
   */
  _registerEventHandlers() {
    // Register handler for order.created event
    notificationService.getInstance().registerHandler('order.created', async (notification) => {
      logger.info(`Order created notification received: ${JSON.stringify(notification.data)}`);
      // Send notification to customer about order creation
      await this.sendOrderCreationNotification(notification.data);

      // Broadcast to WebSocket clients
      this.broadcastEvent('order.created', notification.data);
    });

    // Additional event handlers can be added here
  }

  /**
   * Send notification for order creation
   */
  async sendOrderCreationNotification(orderData) {
    try {
      // Implementation to send email/SMS/push notification to customer
      logger.info(`Sending order creation notification for order ID: ${orderData._id}`);
      // Actual notification sending logic here
    } catch (error) {
      logger.error(`Failed to send order creation notification: ${error.message}`);
    }
  }

  // ===== WEBSOCKET MANAGEMENT =====

  /**
   * Set up WebSocket server
   */
  setupWebSocketServer() {
    this.wss = new WebSocket.Server({ port: process.env.PORT_WS || 3031 });
    this.wss.on('connection', this._handleNewConnection.bind(this));
    logger.info('WebSocket server initialized on port 3031');
  }

  /**
   * Handle new WebSocket connection
   */
  _handleNewConnection(ws, req) {
    const clientId = this._generateClientId();
    logger.info(`New WebSocket client connected: ${clientId}`);

    // Initialize client with default subscription
    this.clients.set(clientId, {
      socket: ws,
      subscriptions: ['order.created'] // Default subscription
    });

    // Send confirmation to client
    this._sendToClient(ws, {
      type: 'connection',
      status: 'connected',
      clientId: clientId,
      message: 'Connected to notification service'
    });

    // Set up event handlers for this connection
    ws.on('message', (message) => this._handleClientMessage(clientId, ws, message));
    ws.on('close', () => this._handleClientDisconnection(clientId));
  }

  /**
   * Handle messages from clients
   */
  _handleClientMessage(clientId, ws, message) {
    try {
      const data = JSON.parse(message);

      if (data.type === 'subscribe') {
        // Update client subscriptions
        const client = this.clients.get(clientId);
        client.subscriptions = data.events || ['order.created'];

        this._sendToClient(ws, {
          type: 'subscription',
          status: 'updated',
          subscriptions: client.subscriptions
        });

        logger.info(`Client ${clientId} updated subscriptions: ${client.subscriptions.join(', ')}`);
      }
    } catch (error) {
      logger.error(`Error processing client message: ${error.message}`);
      this._sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Handle client disconnection
   */
  _handleClientDisconnection(clientId) {
    this.clients.delete(clientId);
    logger.info(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Send message to a client
   */
  _sendToClient(ws, data) {
    ws.send(JSON.stringify(data));
  }

  /**
   * Broadcast event to subscribed clients
   */
  broadcastEvent(eventType, data) {
    const message = JSON.stringify({
      type: 'event',
      eventType: eventType,
      data: data,
      timestamp: new Date().toISOString()
    });

    let broadcastCount = 0;

    this.clients.forEach((client, clientId) => {
      if (client.subscriptions.includes(eventType) && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
        broadcastCount++;
      }
    });

    logger.info(`Broadcasted ${eventType} event to ${broadcastCount} clients`);
  }

  /**
   * Generate a unique client ID
   */
  _generateClientId() {
    return 'client_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = NotificationController;
