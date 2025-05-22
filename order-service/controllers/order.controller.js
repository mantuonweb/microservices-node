const Order = require('../models/order.model');
const Product = require('../models/product.model');
const logger = require('../utils/logger');
const eventManager = require('../utils/send-event');
const { createCircuitBreaker, withCircuitBreaker } = require('../lib/CircuitBreaker');
const NotificationService = require('../lib/notification-manager');
class OrderController {
  async getAllOrders(req, res) {
    try {
      const orders = await Order.find();
      logger.info('Orders retrieved successfully');
      res.json(orders);
    } catch (error) {
      logger.error('Error retrieving orders:', error);
      res.status(500).json({ error: `Error in retrieving orders: ${error.message}` });
    }
  }
  async getAllOrdersById(req, res) {
    console.log('Received request to get orders by email:', req.params.email);
    try {
      const orders = await Order.find({
        'customer.email': req.params.email,
      });
      logger.info('Orders retrieved successfully');
      res.json(orders);
    } catch (error) {
      logger.error('Error retrieving orders:', error);
      res.status(500).json({ error: `Error in retrieving orders: ${error.message}` });
    }
  }
  async getOrderById(req, res) {
    try {
      if (!req.params.id) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      logger.info('Order retrieved successfully:', req.params.id);
      res.json(order);
    } catch (error) {
      logger.error('Error retrieving order:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }
      res.status(500).json({ error: `Error in retrieving order: ${error.message}` });
    }
  }

  async createOrder(req, res) {
    try {
      // Validate request body
      if (!req.body || !req.body.products || !Array.isArray(req.body.products)) {
        return res.status(400).json({ message: 'Invalid order data. Products array is required.' });
      }

      if (!req.body.customer || !req.body.customer.email) {
        return res.status(400).json({ message: 'Customer information with email is required' });
      }

      if (!req.body.mode) {
        return res.status(400).json({ message: 'Payment mode is required' });
      }

      const products = [];
      const reqOrder = req.body;
      let price = 0;

      if (reqOrder.products.length > 0) {
        for (const product of reqOrder.products) {
          if (!product.id) {
            return res.status(400).json({ message: 'Product ID is required for each product' });
          }

          try {
            const productId = product.id;
            const productExists = await Product.findById(productId);
            if (!productExists) {
              return res.status(400).json({
                message: `Product with ID ${productId} not found`
              });
            }

            const quantity = product.quantity || 1;
            if (quantity <= 0) {
              return res.status(400).json({ message: `Invalid quantity for product ${productId}` });
            }

            products.push({ id: productId, name: productExists.name, quantity });
            const productPrice = (productExists.price ?? 0) * quantity;
            price += productPrice;
          } catch (productError) {
            logger.error('Error processing product:', productError);
            if (productError.name === 'CastError') {
              return res.status(400).json({ message: `Invalid product ID format: ${product.id}` });
            }
            throw productError;
          }
        }
      } else {
        return res.status(400).json({ message: 'At least one product is required' });
      }

      reqOrder.totalAmount = price;
      req.body.products = products;

      const order = new Order(req.body);
      const savedOrder = await order.save();

      // Prepare payment data
      const payment = {
        orderId: savedOrder._id.toString(),
        customerId: reqOrder.customer.email,
        amount: savedOrder.totalAmount,
        paymentMethod: reqOrder.mode,
        transactionId: 'tx' + (new Date().getTime().toString()),
      };
      logger.info('Payment data:', payment);

      // Send payment event with error handling
      let payRes;
      try {
        payRes = await eventManager
          .getInstance()
          .sendEvent('payment-service', 'api/payments', payment, req.headers);

        if (!payRes || !payRes.paymentId) {
          logger.error('Payment service returned invalid response', payRes);
          throw new Error('Failed to process payment');
        }
      } catch (paymentError) {
        logger.error('Payment service error:', paymentError);
        // Rollback the order creation
        await Order.findByIdAndDelete(savedOrder._id);
        return res.status(503).json({
          error: 'Payment service unavailable',
          message: 'Order creation failed due to payment processing error'
        });
      }

      // Update inventory
      const productsUpdated = products.map(item => ({ productId: item.id, quantity: item.quantity }));

      try {
        const updateInventory = await eventManager
          .getInstance()
          .sendEvent('inventory-service', 'api/inventories/update-multiple-quantities', productsUpdated, req.headers); ``

        if (!updateInventory || updateInventory.error) {
          throw new Error(updateInventory?.error || 'Inventory update failed');
        }
      } catch (inventoryError) {
        logger.error('Inventory service error:', inventoryError);
        // We don't rollback here as payment is already processed, but we log the issue
        logger.warn('Order created but inventory update failed. Manual intervention may be required.');
      }

      // Update the order with the payment ID
      try {
        savedOrder.paymentId = payRes.paymentId;
        await savedOrder.save();
      } catch (updateError) {
        logger.error('Error updating order with payment ID:', updateError);
        // Order and payment exist but linking failed - needs manual intervention
        logger.warn('Order and payment created but linking failed. Manual intervention required.');
      }

      logger.info('Order created successfully');
      try {
        await NotificationService.getInstance().connect();
        await NotificationService.getInstance().publishNotification('order.created', savedOrder);
      } catch (notificationError) {
        logger.error('Error publishing notification:', notificationError);
      }
      res.status(201).json(savedOrder);
    } catch (error) {
      logger.error('Error creating order:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation error',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ error: `Error in creating order: ${error.message}` });
    }
  }

  async updateOrder(req, res) {
    try {
      if (!req.params.id) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      // First check if the order exists
      const existingOrder = await Order.findById(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Validate request body
      if (!req.body) {
        return res.status(400).json({ message: 'Update data is required' });
      }

      const reqOrder = req.body;
      const updatedProducts = [];

      // Process products if they exist in the request
      if (reqOrder.products && reqOrder.products.length > 0) {
        for (const product of reqOrder.products) {
          if (!product.id) {
            return res.status(400).json({ message: 'Product ID is required for each product' });
          }

          try {
            // Verify product exists in database
            const productExists = await Product.findById(product.id);
            if (!productExists) {
              return res.status(400).json({
                message: `Product with ID ${product.id} not found`
              });
            }

            const quantity = product.quantity || 1;
            if (quantity <= 0) {
              return res.status(400).json({ message: `Invalid quantity for product ${product.id}` });
            }

            // Create product entry according to the schema structure
            updatedProducts.push({
              id: productExists._id,
              name: productExists.name,
              quantity
            });
          } catch (productError) {
            if (productError.name === 'CastError') {
              return res.status(400).json({ message: `Invalid product ID format: ${product.id}` });
            }
            throw productError;
          }
        }
        // Update the products in the request body
        req.body.products = updatedProducts;
      }

      // Set the updated timestamp
      req.body.updatedAt = Date.now();

      // Update the order with all the changes
      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found after update attempt' });
      }

      logger.info('Order updated successfully');
      res.json(updatedOrder);
    } catch (error) {
      logger.error('Error updating order:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation error',
          details: Object.values(error.errors).map(e => e.message)
        });
      }
      res.status(500).json({ error: `Error in updating order: ${error.message}` });
    }
  }

  async deleteOrder(req, res) {
    try {
      if (!req.params.id) {
        return res.status(400).json({ message: 'Order ID is required' });
      }

      const deletedOrder = await Order.findByIdAndDelete(req.params.id);
      if (!deletedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Optionally notify other services about the deletion
      try {
        await eventManager
          .getInstance()
          .sendEvent('inventory-service', 'api/inventories/order-cancelled', {
            orderId: req.params.id
          });
      } catch (notifyError) {
        logger.warn('Failed to notify inventory service about order deletion:', notifyError);
        // Continue with the deletion response as this is a non-critical error
      }

      logger.info('Order deleted successfully');
      res.json({
        message: 'Order deleted successfully',
        order: deletedOrder,
      });
    } catch (error) {
      logger.error('Error deleting order:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid order ID format' });
      }
      res.status(500).json({ error: `Error in deleting order: ${error.message}` });
    }
  }

  async deleteProduct(req, res) {
    try {
      if (!req.params.id) {
        return res.status(400).json({ message: 'Product ID is required' });
      }

      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Check if product is used in any orders before deletion
      const ordersWithProduct = await Order.find({ 'products.id': req.params.id });
      if (ordersWithProduct.length > 0) {
        logger.warn(`Deleted product ${req.params.id} is referenced in ${ordersWithProduct.length} orders`);
      }

      logger.info('Product deleted successfully');
      res.json({
        message: 'Product deleted successfully',
        product: deletedProduct,
      });
    } catch (error) {
      logger.error('Error deleting product:', error);
      if (error.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid product ID format' });
      }
      res.status(500).json({ error: `Error in deleting product: ${error.message}` });
    }
  }
}

// Add global error handler to catch any unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application continues running despite unhandled promise rejection
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // For uncaught exceptions, we might want to exit gracefully after logging
  // process.exit(1); // Uncomment if you want to exit on uncaught exceptions
});

module.exports = withCircuitBreaker(OrderController, createCircuitBreaker);