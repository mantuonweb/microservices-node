const amqp = require('amqplib');
const logger = require('./logger');

class RabbitMQClient {
  static instance = null;
  constructor() {
    this.connection = null;
    this.channel = null;
    this.uri = process.env.RABBITMQ_URL || 'amqp://localhost';
  }

  static getInstance() {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.uri);
      this.channel = await this.connection.createChannel();

      // Create the exchange if it doesn't exist
      await this.channel.assertExchange(
        process.env.RABBITMQ_EXCHANGE || 'product',
        process.env.RABBITMQ_EXCHANGE_TYPE || 'topic',
        { durable: true }
      );

      logger.info('Successfully connected to RabbitMQ');

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

module.exports = RabbitMQClient;