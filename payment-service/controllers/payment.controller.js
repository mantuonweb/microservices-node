const Payment = require('../models/payment.model');

class PaymentController {
  static async processPayment(req, res) {
    try {
      const { orderId, customerId, amount, paymentMethod } = req.body;
      
      // Validate request
      if (!orderId || !customerId || !amount || !paymentMethod) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Create payment record
      const payment = new Payment({
        orderId,
        customerId,
        amount,
        paymentMethod,
        status: 'PENDING'
      });
      
      // Simulate payment processing
      setTimeout(async () => {
        try {
          // Simulate success (in real app, this would integrate with payment gateway)
          const success = Math.random() > 0.2; // 80% success rate
          
          if (success) {
            payment.status = 'COMPLETED';
            payment.transactionId = `tx_${Date.now()}`;
          } else {
            payment.status = 'FAILED';
          }
          
          payment.updatedAt = Date.now();
          await payment.save();
          
          console.log(`Payment ${payment._id} processed with status: ${payment.status}`);
        } catch (error) {
          console.error('Error processing payment:', error);
        }
      }, 2000); // Simulate processing delay
      
      await payment.save();
      res.status(202).json({ 
        message: 'Payment processing initiated',
        paymentId: payment._id
      });
    } catch (error) {
      console.error('Payment processing error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getPayment(req, res) {
    try {
      const payment = await Payment.findById(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      res.status(200).json(payment);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getPaymentsByOrder(req, res) {
    try {
      const payments = await Payment.find({ orderId: req.params.orderId });
      res.status(200).json(payments);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getAllPayments(req, res) {
    try {
      const payments = await Payment.find({});
      res.status(200).json(payments);
    } catch (error) {
      console.error('Error fetching all payments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async refundPayment(req, res) {
    try {
      const payment = await Payment.findById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      if (payment.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'Only completed payments can be refunded' });
      }
      
      // Update payment status
      payment.status = 'REFUNDED';
      payment.updatedAt = Date.now();
      await payment.save();
      
      console.log(`Payment ${payment._id} refunded successfully`);
      
      res.status(200).json({ message: 'Payment refunded successfully', payment });
    } catch (error) {
      console.error('Refund error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

// Export the class directly (no instantiation needed)
module.exports = PaymentController;