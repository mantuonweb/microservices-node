const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

router.get('/', (req, res) =>
  orderController.getAllOrders.fire(req, res)
);
router.post('/', (req, res) =>
  orderController.createOrder.fire(req, res)
);
router.put('/:id', (req, res) =>
  orderController.updateOrder.fire(req, res)
);
router.get('/:id', (req, res) =>
  productController.getProductById.fire(req, res)
);
router.delete('/:id', (req, res) =>
  productController.deleteProduct.fire(req, res)
);

module.exports = router;
