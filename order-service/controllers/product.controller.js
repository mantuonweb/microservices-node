const Product = require('../models/product.model');
const logger = require('../utils/logger');
const { createCircuitBreaker, withCircuitBreaker } = require('../lib/CircuitBreaker');

class ProductController {
  async createProduct(req, res) {
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn('Invalid product data received');
      return res.status(400).json({ message: 'Invalid product data' });
    }
    try {
      const data = req.body;
      if (!data) {
        logger.warn('No product data provided for creation');
        return res.status(400).json({ message: 'No product data provided' });
      }
      console.log('Received data:', data);
      const product = new Product(data);
      const savedProduct = await product.save();
      logger.info('Product created successfully');
      res.status(201).json(savedProduct);
    } catch (error) {
      logger.error('Error creating product:', error.message || error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation error', details: error.message });
      } else if (error.name === 'MongoError' && error.code === 11000) {
        return res.status(409).json({ message: 'Product already exists' });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async deleteProduct(req, res) {
    try {
      const id = req.params.id;
      if (!id) {
        logger.warn('Product ID not provided for deletion');
        return res.status(400).json({ message: 'Product ID is required' });
      }

      const deletedProduct = await Product.findByIdAndDelete(id);
      if (!deletedProduct) {
        logger.warn(`Product with ID ${id} not found for deletion`);
        return res.status(404).json({ message: 'Product not found' });
      }

      logger.info(`Product ${id} deleted successfully`);
      return res.status(200).json(deletedProduct);
    } catch (error) {
      logger.error(`Error deleting product with ID ${req.params.id}:`, error.message || error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = withCircuitBreaker(ProductController, createCircuitBreaker);
