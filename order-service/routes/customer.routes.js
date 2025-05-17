const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// Create new customer
router.post('/', (req, res) =>
  customerController.createCustomer.fire(req, res)
);

// Delete customer
router.delete('/:id', (req, res) =>
  customerController.deleteCustomer.fire(req, res)
);

module.exports = router;
