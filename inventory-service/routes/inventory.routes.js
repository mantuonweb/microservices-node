const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');

// Get all inventory and create new inventory
router
  .route('/')
  .get(inventoryController.getAllInventory)
  .post(inventoryController.createInventory);

// Get, update and delete inventory by product ID
router
  .route('/:productId')
  .get(inventoryController.getInventoryByProductId)
  .put(inventoryController.updateInventory)
  .delete(inventoryController.deleteInventory);

module.exports = router;
