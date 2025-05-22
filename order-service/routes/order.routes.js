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
  orderController.getOrderById.fire(req, res)
);
router.get('/by-email/:email', (req, res) =>
  orderController.getAllOrdersById.fire(req, res)
);

router.delete('/:id', (req, res) =>
  orderController.deleteOrder.fire(req, res)
);

module.exports = router;
