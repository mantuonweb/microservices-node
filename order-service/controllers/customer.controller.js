const Customer = require('../models/customer.model');
const logger = require('../utils/logger');
const createCircuitBreaker = require('../utils/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');
class CustomerController {
  constructor() {}

  async createCustomer(req, res) {
    try {
      const customer = new Customer(req.body);
      const savedCustomer = await customer.save();
      logger.info('New customer created:', savedCustomer._id);
      res.status(201).json(savedCustomer);
    } catch (error) {
      logger.error('Error creating customer:', error);
      res.status(500).json({ message: 'Error creating customer' });
    }
  }

  async deleteCustomer(req, res) {
    try {
      const deletedCustomer = await Customer.find({ username: req.params.id });
      if (!deletedCustomer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      logger.info('Customer deleted:', req.params.id);
      res.status(200).json({ message: 'Customer deleted successfully' });
    } catch (error) {
      logger.error('Error deleting customer:', error);
      res.status(500).json({ message: 'Error deleting customer' });
    }
  }
}

module.exports = withCircuitBreaker(CustomerController, createCircuitBreaker);
