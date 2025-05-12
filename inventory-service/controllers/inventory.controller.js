const Inventory = require('../models/Inventory');
const Product = require('../models/product.model');
const logger = require('../utils/logger');
const createCircuitBreaker = require('../utils/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');

class InventoryController {
  // Get all inventory items
  async getAllInventory(req, res) {
    logger.info('getAllInventory: Fetching all inventory items');
    try {
      const inventoryItems = await Inventory.find();
      logger.info(`getAllInventory: Successfully retrieved ${inventoryItems.length} inventory items`);
      res.status(200).json(inventoryItems);
    } catch (error) {
      logger.error(`getAllInventory: Error fetching inventory items - ${error.message}`, { error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }

  // Get inventory by product ID
  async getInventoryByProductId(req, res) {
    const { productId } = req.params;
    logger.info(`getInventoryByProductId: Fetching inventory for product ID: ${productId}`);
    try {
      const inventory = await Inventory.findOne({
        productId: productId,
      });

      if (!inventory) {
        logger.warn(`getInventoryByProductId: Inventory not found for product ID: ${productId}`);
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      logger.info(`getInventoryByProductId: Successfully retrieved inventory for product ID: ${productId}`);
      res.status(200).json(inventory);
    } catch (error) {
      logger.error(`getInventoryByProductId: Error fetching inventory for product ID: ${productId} - ${error.message}`, { error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }

  // Create new inventory item
  async createInventory(req, res) {
    logger.info('createInventory: Creating new inventory item', { data: req.body });
    try {
      const { productId } = req.body;
      const productExists = await Product.findById(productId);
      if (!productExists) {
        logger.warn(`createInventory: Product with ID ${productId} does not exist`);
        return res.status(404).json({
          success: false,
          error: 'Product not found',
        });
      }
      const inventory = await Inventory.create(req.body);
      logger.info(`createInventory: Successfully created inventory item with ID: ${inventory._id}`);
      res.status(201).json(inventory);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((val) => val.message);
        logger.warn(`createInventory: Validation error - ${messages.join(', ')}`, { error });
        return res.status(400).json({
          success: false,
          error: messages,
        });
      } else {
        logger.error(`createInventory: Error creating inventory item - ${error.message}`, { error });
        res.status(500).json({
          success: false,
          error: 'Server Error',
        });
      }
    }
  }

  // Update inventory
  async updateInventory(req, res) {
    const { productId } = req.params;
    logger.info(`updateInventory: Updating inventory for product ID: ${productId}`, { data: req.body });
    try {
      const inventory = await Inventory.findOneAndUpdate(
        { productId: productId },
        req.body,
        { new: true, runValidators: true }
      );

      if (!inventory) {
        logger.warn(`updateInventory: Inventory not found for product ID: ${productId}`);
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      logger.info(`updateInventory: Successfully updated inventory for product ID: ${productId}`);
      res.status(200).json(inventory);
    } catch (error) {
      logger.warn(`updateInventory: Validation error for product ID: ${productId} - ${error.message}`);
      return res.status(400).json({
        success: false,
        error: 'Error updating inventory',
      });
    }
  }

  // Update quantity for multiple products
  async updateMultipleProductQuantities(req, res) {
    logger.info('updateMultipleProductQuantities: Reducing quantities for multiple products', { data: req.body });
    try {
      const products = req.body;
      
      if (!Array.isArray(products) || products.length === 0) {
        logger.warn('updateMultipleProductQuantities: Invalid request format - products array is required');
        return res.status(400).json({
          success: false,
          error: 'Invalid request format. Expected an array of products with productId and quantity',
        });
      }

      const updateResults = [];
      const errors = [];

      // Process each product update
      for (const product of products) {
        const { productId, quantity } = product;
        
        if (!productId || quantity === undefined) {
          errors.push(`Invalid data for product: ${JSON.stringify(product)}`);
          continue;
        }

        try {
          // First find the current inventory
          const currentInventory = await Inventory.findOne({ productId: productId });
          
          if (!currentInventory) {
            errors.push(`Inventory not found for product ID: ${productId}`);
            continue;
          }
          
          // Calculate new quantity by reducing the requested amount
          const newQuantity = currentInventory.quantity - quantity;
          
          // Prevent negative inventory if needed
          if (newQuantity < 0) {
            errors.push(`Insufficient inventory for product ID: ${productId}. Requested: ${quantity}, Available: ${currentInventory.quantity}`);
            continue;
          }
          
          // Update with the reduced quantity
          const updatedInventory = await Inventory.findOneAndUpdate(
            { productId: productId },
            { quantity: newQuantity },
            { new: true, runValidators: true }
          );

          updateResults.push(updatedInventory);
          
        } catch (error) {
          errors.push(`Error updating product ID ${productId}: ${error.message}`);
        }
      }

      logger.info(`updateMultipleProductQuantities: Updated ${updateResults.length} products, encountered ${errors.length} errors`);
      
      res.status(200).json({
        success: true,
        updatedCount: updateResults.length,
        updatedProducts: updateResults,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      logger.error(`updateMultipleProductQuantities: Error updating multiple products - ${error.message}`, { error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }

  // Delete inventory
  async deleteInventory(req, res) {
    const { productId } = req.params;
    logger.info(`deleteInventory: Deleting inventory for product ID: ${productId}`);
    try {
      const inventory = await Inventory.findOneAndDelete({
        productId: productId,
      });

      if (!inventory) {
        logger.warn(`deleteInventory: Inventory not found for product ID: ${productId}`);
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      logger.info(`deleteInventory: Successfully deleted inventory for product ID: ${productId}`);
      res.status(200).json({
        success: true,
      });
    } catch (error) {
      logger.error(`deleteInventory: Error deleting inventory for product ID: ${productId} - ${error.message}`, { error });
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }
}

module.exports = withCircuitBreaker(InventoryController, createCircuitBreaker);
