const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

router.get('/', (req, res) =>
  orderController.getAllOrdersBreaker.fire(req, res)
);
router.post('/', (req, res) =>
  orderController.createOrderBreaker.fire(req, res)
);
router.put('/:id', (req, res) =>
  orderController.updateOrderBreaker.fire(req, res)
);
router.get('/:id', (req, res) =>
  productController.getProductByIdBreaker.fire(req, res)
);
router.delete('/:id', (req, res) =>
  productController.deleteProductBreaker.fire(req, res)
);

module.exports = router;
