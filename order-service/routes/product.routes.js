const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Create new customer
router.post('/', (req, res) =>
  productController.createProduct.fire(req, res)
);

// Delete customer
router.delete('/:id', (req, res) =>
  productController.deleteProduct.fire(req, res)
);

router.put('/:id', (req, res) =>
  productController.updateProduct.fire(req, res)
);

module.exports = router;
