const Order = require('../models/order.model');
const Product = require('../models/product.model');
const logger = require('../utils/logger');
const eventManager = require('../utils/send-event');
const createCircuitBreaker = require('../utils/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');

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
  async getOrderById(req, res) {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      logger.info('Order retrieved successfully:', req.params.id);
      res.json(order);
    } catch (error) {
      logger.error('Error retrieving order:', error);
      res.status(500).json({ error: `Error in retrieving order: ${error.message}` });
    }
  }
  async createOrder(req, res) {
    try {
      const products = [];
      const reqOrder = req.body;
      let price = 0;
      if (reqOrder.products.length > 0) {
        for (const product of reqOrder.products) {
          const productId = product.id;
          const productExists = await Product.findById(productId);
          if (!productExists) {
            return res.status(400).json({
              message: `Product with ID ${productId} not found`
            });
          }
          products.push({id: productId, name: productExists.name, quantity: product.quantity});
          const productPrice = (productExists.price ?? 0) * (product.quantity ?? 1);
          price += productPrice;
          reqOrder.totalAmount = price;
        }
      }
     
      req.body.products = products;
      const order = new Order(req.body);
      const savedOrder = await order.save();
      const payment = {
        orderId:savedOrder._id.toString(),
        customerId: reqOrder.customer.email,
        amount: savedOrder.totalAmount,
        paymentMethod: reqOrder.mode,
        transactionId: 'tx'+(new Date().getTime().toString()),
      }
      const payRes = await eventManager
              .getInstance()
              .sendEvent('payment-service', 'api/payments', payment);
    
      // Update the order with the payment ID
      savedOrder.paymentId = payRes.paymentId;
      await savedOrder.save();
    
      logger.info('Order created successfully');
      res.status(201).json(savedOrder);
    } catch (error) {
      logger.error('Error creating order:', error);
      res.status(500).json({ error: `Error in creating order: ${error.message}` });
    }
  }

  async updateOrder(req, res) {
    try {
      // First check if the order exists
      const existingOrder = await Order.findById(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const reqOrder = req.body;
      const updatedProducts = [];

      // Process products if they exist in the request
      if (reqOrder.products && reqOrder.products.length > 0) {
        for (const product of reqOrder.products) {
          // Verify product exists in database
          const productExists = await Product.findById(product.id);
          if (!productExists) {
            return res.status(400).json({
              message: `Product with ID ${product.id} not found`
            });
          }

          // Create product entry according to the schema structure
          updatedProducts.push({
            id: productExists._id,
            name: productExists.name,
            quantity: product.quantity || 1
          });
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
        { new: true }
      );

      logger.info('Order updated successfully');
      res.json(updatedOrder);
    } catch (error) {
      logger.error('Error updating order:', error);
      res.status(500).json({ error: `Error in updating order: ${error.message}` });
    }
  }

  async deleteOrder(req, res) {
    try {
      const deletedOrder = await Order.findByIdAndDelete(req.params.id);
      if (!deletedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      logger.info('Order deleted successfully');
      res.json({
        message: 'Order deleted successfully',
        order: deletedOrder,
      });
    } catch (error) {
      logger.error('Error deleting order:', error);
      res.status(500).json({ error: `Error in deleting order: ${error.message}` });
    }
  }

  async deleteProduct(req, res) {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }
      logger.info('Product deleted successfully');
      res.json({
        message: 'Product deleted successfully',
        product: deletedProduct,
      });
    } catch (error) {
      logger.error('Error deleting product:', error);
      res.status(500).json({ error: `Error in deleting product: ${error.message}` });
    }
  }
}

module.exports = withCircuitBreaker(OrderController, createCircuitBreaker);