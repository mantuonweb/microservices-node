const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.get('/', (req, res) =>
  productController.getAllProductsBreaker.fire(req, res)
);
router.post('/', (req, res) =>
  productController.createProductBreaker.fire(req, res)
);
router.put('/:id', (req, res) =>
  productController.updateProductBreaker.fire(req, res)
);
router.get('/:id', (req, res) =>
  productController.getProductByIdBreaker.fire(req, res)
);
router.delete('/:id', (req, res) =>
  productController.deleteProductBreaker.fire(req, res)
);

module.exports = router;
