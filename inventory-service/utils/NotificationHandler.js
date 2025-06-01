const notificationService = require('../lib/notification-manager');

class NotificationHandler {
  constructor() {
    this.notificationService = notificationService;
  }

  async initialize() {
    try {
      await this.notificationService.getInstance().connect();
      
      // Register handler for order.reprocess event
      this.notificationService.getInstance().registerHandler('order.reprocess', (notification) => {
        console.info(`Order repoc notification received: ${JSON.stringify(notification.data)}`);
      });
      
      await this.notificationService.getInstance().startListening();
    } catch (error) {
      console.error('Error in handling notifications:', error);
    }
    
    return this.notificationService;
  }
}

module.exports = NotificationHandler;