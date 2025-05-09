const Customer = require('../models/customer.model');
const logger = require('../utils/logger');
const createCircuitBreaker = require('../utils/circuitBreaker');

class CustomerController {
  constructor() {
    // Initialize circuit breakers
    this.getAllCustomersBreaker = createCircuitBreaker(
      this.getAllCustomers.bind(this)
    );
    this.createCustomerBreaker = createCircuitBreaker(
      this.createCustomer.bind(this)
    );
    this.updateCustomerBreaker = createCircuitBreaker(
      this.updateCustomer.bind(this)
    );
    this.deleteCustomerBreaker = createCircuitBreaker(
      this.deleteCustomer.bind(this)
    );
    this.getCustomerByIdBreaker = createCircuitBreaker(
      this.getCustomerById.bind(this)
    );
  }

  async getCustomerById(req, res) {
    logger.info('Customer retrieved successfully:', req.params.id);
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      logger.info('Customer retrieved successfully:', req.params.id);
      res.json(customer);
    } catch (error) {
      logger.error('Error retrieving customer:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAllCustomers(req, res) {
    try {
      const customers = await Customer.find();
      logger.info('Customers retrieved successfully');
      res.json(customers);
    } catch (error) {
      logger.error('Error retrieving customers:', error);
      res.status(500).json({ error: error.message });
    }
  }

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

  async updateCustomer(req, res) {
    try {
      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        req.body
      );
      const updatedCustomer = await customer.save();
      logger.info('Customer updated:', req.params.id);
      res.status(200).json(updatedCustomer);
    } catch (error) {
      logger.error('Error updating customer:', error);
      res.status(500).json({ message: 'Error updating customer' });
    }
  }

  async deleteCustomer(req, res) {
    try {
      const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
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

module.exports = new CustomerController();
