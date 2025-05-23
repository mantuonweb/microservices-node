const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

// Get all customers
router.get('/', (req, res) =>
  customerController.getAllCustomers.fire(req, res)
);

// Get customer by ID
router.get('/:id', (req, res) =>
  customerController.getCustomerById.fire(req, res)
);
router.get('/email/:email', (req, res) =>
  customerController.getCustomerByEmail.fire(req, res)
);

// Create new customer
router.post('/', (req, res) =>
  customerController.createCustomer.fire(req, res)
);

// Update customer
router.put('/:id', (req, res) =>
  customerController.updateCustomer.fire(req, res)
);

// Delete customer
router.delete('/:id', (req, res) =>
  customerController.deleteCustomer.fire(req, res)
);

module.exports = router;
