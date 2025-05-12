const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');

router
  .route('/')
  .get((req, res) => inventoryController.getAllInventory.fire(req, res))
  .post((req, res) => inventoryController.createInventory.fire(req, res));

// Get, update and delete inventory by product ID
router
  .route('/:productId')
  .get((req, res) => inventoryController.getInventoryByProductId.fire(req, res))
  .put((req, res) => inventoryController.updateInventory.fire(req, res))
  .delete((req, res) => inventoryController.deleteInventory.fire(req, res));

router.post('/update-multiple-quantities', (req, res) => inventoryController.updateMultipleProductQuantities.fire(req, res));

module.exports = router;