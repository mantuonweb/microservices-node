const Inventory = require('../models/Inventory');
const logger = require('../utils/logger');
const createCircuitBreaker = require('../utils/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');
class InventoryController {
  constructor() {
    // Create circuit breakers for all methods
    this.getAllInventoryBreaker = createCircuitBreaker(
      this.getAllInventory.bind(this)
    );

    this.getInventoryByProductIdBreaker = createCircuitBreaker(
      this.getInventoryByProductId.bind(this)
    );

    this.createInventoryBreaker = createCircuitBreaker(
      this.createInventory.bind(this)
    );

    this.updateInventoryBreaker = createCircuitBreaker(
      this.updateInventory.bind(this)
    );

    this.deleteInventoryBreaker = createCircuitBreaker(
      this.deleteInventory.bind(this)
    );
  }

  // Get all inventory items
  async getAllInventory(req, res) {
    try {
      const inventoryItems = await Inventory.find();
      res.status(200).json(inventoryItems);
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }

  // Get inventory by product ID
  async getInventoryByProductId(req, res) {
    try {
      const inventory = await Inventory.findOne({
        productId: req.params.productId,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      res.status(200).json(inventory);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }

  // Create new inventory item
  async createInventory(req, res) {
    try {
      const inventory = await Inventory.create(req.body);

      res.status(201).json(inventory);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((val) => val.message);
        return res.status(400).json({
          success: false,
          error: messages,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Server Error',
        });
      }
    }
  }

  // Update inventory
  async updateInventory(req, res) {
    try {
      const inventory = await Inventory.findOneAndUpdate(
        { productId: req.params.productId },
        req.body,
        { new: true, runValidators: true }
      );

      if (!inventory) {
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      res.status(200).json(inventory);
    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((val) => val.message);
        return res.status(400).json({
          success: false,
          error: messages,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Server Error',
        });
      }
    }
  }

  // Delete inventory
  async deleteInventory(req, res) {
    try {
      const inventory = await Inventory.findOneAndDelete({
        productId: req.params.productId,
      });

      if (!inventory) {
        return res.status(404).json({
          success: false,
          error: 'Inventory not found for this product',
        });
      }

      res.status(200).json({
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Server Error',
      });
    }
  }
}

module.exports = withCircuitBreaker(InventoryController, createCircuitBreaker);
