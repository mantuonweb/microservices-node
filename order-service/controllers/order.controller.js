const Order = require('../models/order.model');
const logger = require('../utils/logger');
const rabbitMQClient = require('../utils/RabbitMQClient');
const createCircuitBreaker = require('../middleware/circuitBreaker');

class OrderController {
  constructor() {
    this.getAllOrdersBreaker = createCircuitBreaker(
      this.getAllOrders.bind(this)
    );
    this.createOrderBreaker = createCircuitBreaker(this.createOrder.bind(this));
    this.updateOrderBreaker = createCircuitBreaker(this.updateOrder.bind(this));
    this.deleteOrderBreaker = createCircuitBreaker(this.deleteOrder.bind(this));
    this.getOrderByIdBreaker = createCircuitBreaker(
      this.getOrderById.bind(this)
    );
  }

  async getAllOrders(req, res) {
    try {
      const orders = await Order.find();
      logger.info('Orders retrieved successfully');
      res.json(orders);
    } catch (error) {
      logger.error('Error retrieving orders:', error);
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  }
  async createOrder(req, res) {
    try {
      const order = new Order(req.body);
      const savedOrder = await order.save();
      // rabbitMQClient.publishMessage(
      //   'order',
      //   'order.created',
      //   {
      //     event: 'ORDER_CREATED',
      //     orderId: savedOrder._id,
      //     data: savedOrder
      //   }
      // ).catch(err => logger.error('Failed to publish message:', err));
      logger.info('Order created successfully');
      res.status(201).json(savedOrder);
    } catch (error) {
      logger.error('Error creating order:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateOrder(req, res) {
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }
      logger.info('Order updated successfully');
      res.json(updatedOrder);
    } catch (error) {
      logger.error('Error updating order:', error);
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new OrderController();
