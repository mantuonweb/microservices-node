const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// Get all customers
router.get('/', (req, res) =>
  customerController.getAllCustomersBreaker.fire(req, res)
);

// Get customer by ID
router.get('/:id', (req, res) =>
  customerController.getCustomerByIdBreaker.fire(req, res)
);

// Create new customer
router.post('/', (req, res) =>
  customerController.createCustomerBreaker.fire(req, res)
);

// Update customer
router.put('/:id', (req, res) =>
  customerController.updateCustomerBreaker.fire(req, res)
);

// Delete customer
router.delete('/:id', (req, res) =>
  customerController.deleteCustomerBreaker.fire(req, res)
);

module.exports = router;
