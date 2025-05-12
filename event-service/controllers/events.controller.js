const logger = require('../utils/logger');

class EventController {
  // Get user profile
  static async dispatchSync(req, res) {
    try {
      logger.info('Event dispatched successfully', req.body);

      res.status(200).json({ status: 'success' });
    } catch (error) {
      logger.error('Error in event dispatch', {
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = EventController;
