const Inventory = require('../models/Inventory');

// Get all inventory items
exports.getAllInventory = async (req, res) => {
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
};

// Get inventory by product ID
exports.getInventoryByProductId = async (req, res) => {
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
};

// Create new inventory item
exports.createInventory = async (req, res) => {
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
};

// Update inventory
exports.updateInventory = async (req, res) => {
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
};

// Delete inventory
exports.deleteInventory = async (req, res) => {
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
};
