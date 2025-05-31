const express = require('express');
const router = express.Router();
const paymentTransactionController = require('../controllers/payment-transaction.controller');

// Create a new payment transaction
router.post('/', paymentTransactionController.createTransaction.bind(paymentTransactionController));

// Get all payment transactions with pagination
router.get('/', paymentTransactionController.getAllTransactions.bind(paymentTransactionController));

// Get a payment transaction by ID
router.get('/:id', paymentTransactionController.getTransactionById.bind(paymentTransactionController));

// Get payment transactions by orderId
router.get('/order/:orderId', paymentTransactionController.getTransactionsByOrderId.bind(paymentTransactionController));

// Update a payment transaction
router.put('/:id', paymentTransactionController.updateTransaction.bind(paymentTransactionController));

// Update transaction status
router.patch('/:id/status', paymentTransactionController.updateTransactionStatus.bind(paymentTransactionController));

// Increment retry count
router.patch('/:id/retry', paymentTransactionController.incrementRetry.bind(paymentTransactionController));

// Delete a payment transaction
router.delete('/:id', paymentTransactionController.deleteTransaction.bind(paymentTransactionController));

module.exports = router;