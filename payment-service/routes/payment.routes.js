const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Process a new payment
router.post('/', paymentController.processPayment);

router.get('/', paymentController.getAllPayments);
// Get payment by ID
router.get('/:id', paymentController.getPayment);

// Get payments by order ID
router.get('/order/:orderId', paymentController.getPaymentsByOrder);

// Refund a payment
router.post('/:id/refund', paymentController.refundPayment);

module.exports = router;
