const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

// Process a new payment
router.post('/', (req, res) => paymentController.processPayment.fire(req, res));

router.get('/', (req, res) => paymentController.getAllPayments.fire(req, res));
// Get payment by ID
router.get('/:id', (req, res) => paymentController.getPayment.fire(req, res));

// Get payments by order ID
router.get('/order/:orderId', (req, res) => paymentController.getPaymentsByOrder.fire(req, res));

// Refund a payment
router.post('/:id/refund', (req, res) => paymentController.refundPayment.fire(req, res));

module.exports = router;