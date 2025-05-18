const rabbitMQClient = require('../utils/RabbitMQClient');
const logger = require('../utils/logger');
const productController = require('../controllers/product.controller');

const listenProductUpdates = async () => {
  await rabbitMQClient.getInstance().subscribeToMessages(
    process.env.RABBITMQ_EXCHANGE_PRODUCT,
    'product.created',
    'inventory-service.product-updates', // queue name
    (productEvent) => {
      const { event, data, productId, status } = productEvent;
      logger.info(`Received product event: ${event}, status: ${status}, productId: ${productId}`);
      
      try {
        if (event === 'PRODUCT_CREATED' && status === 'SUCCESS') {
          // Handle successful product creation
          logger.info(`Processing successful product creation: ${productId}`);
          productController.createProduct({ ...data, _id: productId });
        }
        else if (event === 'PRODUCT_CREATED' && status === 'FAILED') {
          // Handle compensation for failed product creation
          logger.info(`Processing compensation for failed product: ${productId}`);
          productController.deleteProduct(productId);
        }
      } catch (error) {
        logger.error(`Failed to process product event ${event} for product ${productId}:`, error);
      }
    }
  );
  
  logger.info('Product update listener initialized');
};

module.exports = {
  listenProductUpdates,
};
