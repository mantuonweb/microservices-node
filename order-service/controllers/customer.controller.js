const Customer = require('../models/customer.model');
const logger = require('../utils/logger');
const { createCircuitBreaker, withCircuitBreaker } = require('../lib/CircuitBreaker');

class CustomerController {
  constructor() {}

  async createCustomer(req, res) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        logger.warn('Invalid customer data received');
        return res.status(400).json({ message: 'Invalid customer data' });
      }
      
      // Check if user with same email or username already exists
      const { email, username } = req.body;
      const existingCustomer = await Customer.findOne({ 
        $or: [
          { email: email },
          { username: username }
        ]
      });
      
      if (existingCustomer) {
        const duplicateField = existingCustomer.email === email ? 'email' : 'username';
        logger.warn(`Customer with this ${duplicateField} already exists`);
        return res.status(409).json({ 
          message: `Customer with this ${duplicateField} already exists` 
        });
      }
      
      const customer = new Customer(req.body);
      const savedCustomer = await customer.save();
      logger.info('New customer created:', savedCustomer._id);
      res.status(201).json(savedCustomer);
    } catch (error) {
      logger.error('Error creating customer:', error);
      
      // More specific error handling
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation error', details: error.message });
      } else if (error.name === 'MongoError' && error.code === 11000) {
        return res.status(409).json({ message: 'Customer already exists' });
      }
      
      res.status(500).json({ message: 'Error creating customer' });
    }
  }

  async deleteCustomer(req, res) {
    try {
      if (!req.params.id) {
        logger.warn('Customer ID not provided for deletion');
        return res.status(400).json({ message: 'Customer ID is required' });
      }
      
      const deletedCustomer = await Customer.find({ username: req.params.id });
      
      // Check if customer exists
      if (!deletedCustomer || deletedCustomer.length === 0) {
        logger.warn(`Customer not found for deletion: ${req.params.id}`);
        return res.status(404).json({ message: 'Customer not found' });
      }
      
      // Actually delete the customer (this was missing in the original code)
      await Customer.deleteOne({ username: req.params.id });
      
      logger.info('Customer deleted:', req.params.id);
      res.status(200).json({ message: 'Customer deleted successfully' });
    } catch (error) {
      logger.error('Error deleting customer:', error);
      res.status(500).json({ message: 'Error deleting customer' });
    }
  }
}

// Add process-level uncaught exception handler if not already present elsewhere
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Optionally perform cleanup here
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally perform cleanup here
});

module.exports = withCircuitBreaker(CustomerController, createCircuitBreaker);
