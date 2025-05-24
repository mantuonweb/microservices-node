const express = require('express');
const router = express.Router();
const queryController = require('../controllers/query.controller');

router.get('/order-by-email/:email', (req, res) =>
  queryController.getAllOrderByEmail.fire(req, res)
);
router.get('/products', (req, res) =>
  queryController.getAllProduct.fire(req, res)
);
module.exports = router;
