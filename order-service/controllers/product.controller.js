const Product = require('../models/product.model');
const logger = require('../utils/logger');

class ProductController {
  async getAllProducts() {
    try {
      const products = await Product.find();
      logger.info('Products retrieved successfully');
      return products;
    } catch (error) {
      logger.error('Error retrieving products:', error);
      return [];
    }
  }
  async getProductById(id) {
    try {
      const product = await Product.findById(id);
      return product;
    } catch (error) {
      logger.error('Error retrieving product:', error);
      return null;
    }
  }
  async createProduct(data) {
    try {
      const product = new Product(data);
      const savedProduct = await product.save();
      logger.info('Product created successfully');
      return savedProduct;
    } catch (error) {
      logger.error('Error creating product:', error);
      return null;
    }
  }

  async updateProduct(data) {
    try {
      const updatedProduct = await Product.findByIdAndUpdate(data.id, ...data, {
        new: true,
      });
      if (!updatedProduct) {
        return null;
      }
      logger.info('Product updated successfully');
      return updatedProduct;
    } catch (error) {
      logger.error('Error updating product:', error);
      return null;
    }
  }

  async deleteProduct(id) {
    try {
      const deletedProduct = await Product.findByIdAndDelete(id);
      if (!deletedProduct) {
        return null;
      }
      logger.info('Product deleted successfully');
      return deletedProduct;
    } catch (error) {
      logger.error('Error deleting product:', error);
      return null;
    }
  }
}

module.exports = new ProductController();
