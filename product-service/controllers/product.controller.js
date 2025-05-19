const Product = require('../models/product.model');
const logger = require('../utils/logger');
const eventManager = require('../utils/send-event');
const { withCircuitBreaker, createCircuitBreaker } = require('../lib/CircuitBreaker');

class ProductController {
  async getAllProducts(req, res) {
    try {
      const products = await Product.find();
      logger.info('Products retrieved successfully');
      res.json(products);
    } catch (error) {
      logger.error('Error retrieving products:', error);
      res.status(500).json({ error: error.message });
    }
  }
  async getProductById(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      logger.info('Product retrieved successfully:', req.params.id);
      res.json(product);
    } catch (error) {
      logger.error('Error retrieving product:', error);
      res.status(500).json({ error: error.message });
    }
  }
  async createProduct(req, res) {
    let savedProduct = null;
    try {
      // Create a new Product instance using the data from the request body
      const product = new Product(req.body);
      savedProduct = await product.save();
      let prodResOrder, prodResInventory;
      try {
        prodResOrder = await eventManager
          .getInstance()
          .sendEvent('order-service', 'api/orders/products', savedProduct, req.headers);
        prodResInventory = await eventManager
          .getInstance()
          .sendEvent('inventory-service', 'api/inventories/products', savedProduct, req.headers);
        if ((!prodResOrder || !prodResOrder.name) || (!prodResInventory || !prodResInventory.name)) {
          logger.error('Service returned invalid response', prodResOrder, prodResInventory);
          throw new Error('Failed to notify dependent services');
        }
      } catch (productError) {
        logger.error('Service communication error:', productError);
        await Product.findByIdAndDelete(savedProduct._id);
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Failed to communicate with dependent services'
        });
      }
      logger.info('Product created successfully');
      res.status(201).json(savedProduct);
    } catch (error) {
      logger.error('Error creating product:', error);

      // Compensation logic - if we created the product but failed at a later step
      if (savedProduct && savedProduct._id) {
        try {
          logger.info(`Executing compensation: Deleting product ${savedProduct._id}`);
          await Product.findByIdAndDelete(savedProduct._id);
          logger.info(`Compensation completed: Product ${savedProduct._id} deleted`);
        } catch (compensationError) {
          logger.error('Error in compensation:', compensationError);
        }
      }

      res.status(500).json({ error: error.message });
    }
  }

  async updateProduct(req, res) {
    try {
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      logger.info('Product updated successfully');
      res.json(updatedProduct);
    } catch (error) {
      logger.error('Error updating product:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async deleteProduct(req, res) {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      logger.info('Product deleted successfully');
      res.json({
        message: 'Product deleted successfully',
        product: deletedProduct,
      });
    } catch (error) {
      logger.error('Error deleting product:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = withCircuitBreaker(ProductController, createCircuitBreaker);
