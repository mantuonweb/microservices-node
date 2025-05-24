const logger = require('../utils/logger');
const eventManager = require('../utils/send-event');
const RedisClient = require('../lib/RedisClient');
const { withCircuitBreaker, createCircuitBreaker } = require('../lib/CircuitBreaker');

class QueryController {
  async getAllOrderByEmail(req, res) {
    try {
      const { email } = req.params;
      const cacheKey = `orderbyemail:${email}`;
      try {
        const cachedOrders = await RedisClient.getInstance().getJSON(cacheKey);
        if (cachedOrders) {
          return res.json(cachedOrders);
        }
      } catch (cacheError) {
        console.log('Cache miss or error:', cacheError);
      }
    
      // Fetch from database
      const eventInstance = eventManager.getInstance();

      // Fetch data from all services in parallel
      const [orderList, paymentsResponse, productsList] = await Promise.all([
        eventInstance.sendEvent('order-service', `api/orders/by-email/${email}`, null, req.headers, 'get'),
        eventInstance.sendEvent('payment-service', 'api/payments', null, req.headers, 'get'),
        eventInstance.sendEvent('product-service', 'api/products', null, req.headers, 'get')
      ]);

      const paymentsList = paymentsResponse?.payments || [];

      // Create maps for faster lookups
      const productsMap = productsList.reduce((map, product) => {
        map[product._id] = product;
        return map;
      }, {});

      // Create payment map for faster lookup
      const paymentsMap = paymentsList.reduce((map, payment) => {
        map[payment.orderId] = payment;
        return map;
      }, {});

      // Process orders and enrich with product, inventory, and payment data
      const enrichedOrders = orderList.reduce((result, order) => {
        // Enrich each product in the order with its details
        const enrichedProducts = order.products.map(orderProduct => {
          const productDetails = productsMap[orderProduct.id] || {};
          return {
            ...orderProduct,
            price: productDetails.price || 0,
            description: productDetails.description || ''
          };
        });

        // Only include orders that have at least one product
        if (enrichedProducts.length > 0) {
          // Get payment details for this order
          const paymentDetails = paymentsMap[order._id] || {};

          result.push({
            ...order,
            products: enrichedProducts,
            payment: {
              status: paymentDetails.status || 'PENDING',
              method: paymentDetails.paymentMethod || order.mode,
              transactionId: paymentDetails.transactionId || 'N/A',
              processedAt: paymentDetails.updatedAt || order.updatedAt
            }
          });
        }
        return result;
      }, []);
    
      // Save to cache for future requests
      try {
        await RedisClient.getInstance().setJSON(cacheKey, '.', enrichedOrders, { expiry: 3600 });
      } catch (cacheError) {
        console.error('Error saving to redis:', cacheError.message);
        // Don't return here, continue to return the orders
      }
    
      return res.json(enrichedOrders);
    } catch (error) {
      console.error('Error retrieving orders:', error.message);
      // Only send error response if no response has been sent yet
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to retrieve orders' });
      }
    }
  }
  async getAllProduct(req, res) {
    try {
      const eventInstance = eventManager.getInstance();

      // Fetch data from all services in parallel
      const [productsList, inventoryList] = await Promise.all([
        eventInstance.sendEvent('product-service', 'api/products', null, req.headers, 'get'),
        eventInstance.sendEvent('inventory-service', 'api/inventories', null, req.headers, 'get')
      ]);

      // Create a map of inventories by productId for faster lookup
      const inventoryMap = inventoryList.reduce((map, inventory) => {
        map[inventory.productId] = inventory;
        return map;
      }, {});

      const INVENTORY_THRESHOLD = 100;

      // Merge each product with its inventory data and filter for inventory > threshold
      const mergedProducts = productsList
        .map(product => {
          const inventory = inventoryMap[product._id] || null;
          return {
            _id: product._id,
            name: product.name,
            price: product.price,
            description: product.description,
            inventory: inventory ? {
              quantity: inventory.quantity,
              lastUpdated: inventory.lastUpdated
            } : null
          };
        })
        .filter(product =>
          product.inventory && product.inventory.quantity > INVENTORY_THRESHOLD
        );

      res.json(mergedProducts);
    } catch (error) {
      logger.error('Error retrieving orders:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = withCircuitBreaker(QueryController, createCircuitBreaker);
