const rabbitMQClient = require('../utils/RabbitMQClient');
const logger = require('../utils/logger');
const productController = require('../controllers/product.controller');
const listenProductUpdates = async () => {
  const exchange = process.env.RABBITMQ_EXCHANGE_PRODUCT
  await rabbitMQClient.getInstance().subscribeToMessages(
     exchange,
    'product.created',
    'order-service.product-updates', // queue name
    (productEvent) => {
      const { event, data, productId } = productEvent;
      try {
        if (event === 'PRODUCT_CREATED') {
          productController.createProduct({ ...data, id: productId });
        }
      } catch (error) {
        logger.error('Failed to process product event:', error);
      }

      console.log('Received message:', event, data, productId, productEvent);
      // Your business logic here
    }
  );
};

module.exports = {
  listenProductUpdates,
};
