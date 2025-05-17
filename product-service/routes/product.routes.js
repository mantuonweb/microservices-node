const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/', (req, res) =>
  productController.getAllProducts.fire(req, res)
);
router.post('/', (req, res) =>
  productController.createProduct.fire(req, res)
);
router.put('/:id', (req, res) =>
  productController.updateProduct.fire(req, res)
);
router.get('/:id', (req, res) =>
  productController.getProductById.fire(req, res)
);
router.delete('/:id', (req, res) =>
  productController.deleteProduct.fire(req, res)
);

module.exports = router;
