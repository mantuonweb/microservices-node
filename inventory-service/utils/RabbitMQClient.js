const amqp = require('amqplib');
const logger = require('./logger');

class RabbitMQClient {
  constructor(config = {}) {
    this.connection = null;
    this.channel = null;
    this.uri = config.url || process.env.RABBITMQ_URI || 'amqp://localhost';
    this.exchange =
      config.exchange || process.env.RABBITMQ_EXCHANGE_PRODUCT || 'product';
    this.exchangeType =
      config.exchangeType || process.env.RABBITMQ_EXCHANGE_PRODUCT_TYPE || 'topic';
    this.exchangeOptions = config.exchangeOptions || { durable: true };
    this.passiveExchange = config.passiveExchange || false;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.uri);
      this.channel = await this.connection.createChannel();

      // Create the exchange if it doesn't exist
      await this.channel.assertExchange(
        this.exchange,
        this.exchangeType,
        this.exchangeOptions
      );

      logger.info(
        `Successfully connected to RabbitMQ and created exchange ${this.exchange}`
      );

      // Handle connection errors
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        setTimeout(() => this.connect(), 5000);
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, trying to reconnect...');
        setTimeout(() => this.connect(), 5000);
      });

      return this.channel;
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publishMessage(exchange, routingKey, message) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      logger.info(`Message published to ${exchange}:${routingKey}`);
    } catch (error) {
      logger.error('Error publishing message:', error);
      throw error;
    }
  }
  async subscribeToMessages(exchange, routingKey, queueName, callback) {
    try {
      if (!this.channel) {
        await this.connect();
      }

      // Make sure the exchange exists
      await this.channel.assertExchange(
        exchange,
        this.exchangeType,
        this.exchangeOptions
      );

      // Assert the queue
      await this.channel.assertQueue(queueName, { durable: true });

      // Bind the queue to the exchange with the specified routing key
      await this.channel.bindQueue(queueName, exchange, routingKey);

      logger.info(
        `Queue ${queueName} bound to ${exchange} with routing key ${routingKey}`
      );

      // Set up the consumer
      await this.channel.consume(queueName, (message) => {
        if (message) {
          try {
            const content = JSON.parse(message.content.toString());
            callback(content);
            this.channel.ack(message);
          } catch (error) {
            logger.error('Error processing message:', error);
            this.channel.nack(message);
          }
        }
      });

      logger.info(`Subscribed to queue ${queueName}`);
    } catch (error) {
      logger.error('Error subscribing to messages:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed gracefully');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
  }
}

module.exports = new RabbitMQClient({
  url: process.env.RABBITMQ_URI || 'amqp://localhost',
  exchange: process.env.RABBITMQ_EXCHANGE_PRODUCT || 'product_message',
  exchangeType: process.env.RABBITMQ_EXCHANGE_PRODUCT_TYPE || 'topic', // Changed from 'fanout' to 'topic' to be consistent
  exchangeOptions: { durable: true },
  passiveExchange: false,
});
