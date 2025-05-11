const Product = require('../models/product.model');
const logger = require('../utils/logger');
const rabbitMQClient = require('../utils/RabbitMQClient');
const createCircuitBreaker = require('../middleware/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');
const exchange = process.env.RABBITMQ_EXCHANGE
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
    try {
      const product = new Product(req.body);
      const savedProduct = await product.save();
      rabbitMQClient.getInstance().publishMessage(exchange, 'product.created', {
          event: 'PRODUCT_CREATED',
          productId: savedProduct._id,
          data: savedProduct,
        })
        .catch((err) => logger.error('Failed to publish message:', err));
      logger.info('Product created successfully');
      res.status(201).json(savedProduct);
    } catch (error) {
      logger.error('Error creating product:', error);
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
