const Product = require('../models/product.model');
const logger = require('../utils/logger');
const rabbitMQClient = require('../utils/RabbitMQClient');
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
      
      // Save the new product to the database and get the saved instance
      savedProduct = await product.save();
      
      // Get the RabbitMQ exchange name from environment variables
      const exchange = process.env.RABBITMQ_EXCHANGE
      
      // Publish a message to RabbitMQ about the product creation event
      await rabbitMQClient.getInstance().publishMessage(exchange, 'product.created', {
          event: 'PRODUCT_CREATED',
          productId: savedProduct._id,
          data: savedProduct,
          status: 'SUCCESS'
        });
      
      logger.info('Product created successfully');
      res.status(201).json(savedProduct);
    } catch (error) {
      logger.error('Error creating product:', error);
      
      // Compensation logic - if we created the product but failed at a later step
      if (savedProduct && savedProduct._id) {
        try {
          logger.info(`Executing compensation: Deleting product ${savedProduct._id}`);
          await Product.findByIdAndDelete(savedProduct._id);
          
          // Notify other services about the failed transaction
          const exchange = process.env.RABBITMQ_EXCHANGE;
          await rabbitMQClient.getInstance().publishMessage(exchange, 'product.created', {
            event: 'PRODUCT_CREATED',
            productId: savedProduct._id,
            status: 'FAILED',
            error: error.message
          });
          
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
