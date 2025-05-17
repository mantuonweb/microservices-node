const Product = require('../models/product.model');
const logger = require('../utils/logger');

class ProductController {
  async getAllProducts() {
    try {
      const products = await Product.find();
      logger.info('Products retrieved successfully');
      return products;
    } catch (error) {
      logger.error('Error retrieving products:', error.message || error);
      // Return empty array instead of throwing the error up the call stack
      return [];
    }
  }
  async getProductById(id) {
    try {
      if (!id) {
        logger.warn('Product ID not provided');
        return null;
      }
      
      const product = await Product.findById(id);
      if (!product) {
        logger.info(`Product with ID ${id} not found`);
      }
      return product;
    } catch (error) {
      logger.error(`Error retrieving product with ID ${id}:`, error.message || error);
      return null;
    }
  }
  async createProduct(data) {
    try {
      if (!data) {
        logger.warn('No product data provided for creation');
        return null;
      }
      
      const product = new Product(data);
      const savedProduct = await product.save();
      logger.info('Product created successfully');
      return savedProduct;
    } catch (error) {
      logger.error('Error creating product:', error.message || error);
      return null;
    }
  }

  async updateProduct(data) {
    try {
      if (!data || !data.id) {
        logger.warn('Invalid product data or missing ID for update');
        return null;
      }
      
      // Fix the spread operator issue
      const { id, ...updateData } = data;
      const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true
      });
      
      if (!updatedProduct) {
        logger.warn(`Product with ID ${id} not found for update`);
        return null;
      }
      
      logger.info(`Product ${id} updated successfully`);
      return updatedProduct;
    } catch (error) {
      logger.error(`Error updating product with ID ${data?.id}:`, error.message || error);
      return null;
    }
  }

  async deleteProduct(id) {
    try {
      if (!id) {
        logger.warn('Product ID not provided for deletion');
        return null;
      }
      
      const deletedProduct = await Product.findByIdAndDelete(id);
      if (!deletedProduct) {
        logger.warn(`Product with ID ${id} not found for deletion`);
        return null;
      }
      
      logger.info(`Product ${id} deleted successfully`);
      return deletedProduct;
    } catch (error) {
      logger.error(`Error deleting product with ID ${id}:`, error.message || error);
      return null;
    }
  }
}

module.exports = new ProductController();
