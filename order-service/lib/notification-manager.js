const amqp = require('amqplib');
const logger = require('../utils/logger');
/**
 * RabbitMQ Notification Service
 * A complete service for publishing and consuming notifications via RabbitMQ
 */
class RabbitMQNotificationService {
  instance = null;
  static getInstance() {
    if (!this.instance) {
      this.instance = new RabbitMQNotificationService({
        clientId: 'order-service'
      });
    }
    return this.instance;
  }
  /**
   * Create a new RabbitMQ notification service
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    // RabbitMQ connection configuration with sensible defaults
    this.config = {
      url: config.url || process.env.RABBITMQ_URL || 'amqp://guest:guest@ms-rabbitmq:5672',
      exchange: config.exchange || 'notifications',
      exchangeType: config.exchangeType || 'topic',
      clientId: config.clientId || 'order-service',
      queuePrefix: config.queuePrefix || 'order-service-',
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      ...config
    };

    logger.info(`Initializing RabbitMQ notification service for ${this.config.clientId}`);
    logger.info(`RabbitMQ URL: ${this.config.url}`);
    logger.info(`Exchange: ${this.config.exchange} (${this.config.exchangeType})`);

    // Connection state
    this.connection = null;
    this.publishChannel = null;
    this.consumeChannel = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;

    // Message handlers
    this.handlers = new Map();
    this.consumerTag = null;
    this.queueName = null;

    // Bind methods to ensure correct 'this' context
    this.connect = this.connect.bind(this);
    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.publishNotification = this.publishNotification.bind(this);
    this.startListening = this.startListening.bind(this);
    this.disconnect = this.disconnect.bind(this);

    // Set up graceful shutdown
    process.on('SIGINT', this.handleSigInt.bind(this));
    process.on('SIGTERM', this.handleSigInt.bind(this));
  }

  /**
   * Sleep for a specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Promise that resolves after the specified time
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique ID
   * @returns {string} - A unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Connect to RabbitMQ
   * @returns {Promise} - Resolves when connected
   */
  async connect() {
    if (this.isConnected) return;

    try {
      logger.info(`Connecting to RabbitMQ at ${this.config.url} (attempt ${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);

      // Create the connection
      this.connection = await amqp.connect(this.config.url);

      // Set up connection event handlers
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err.message);
        this.handleDisconnect();
      });

      this.connection.on('close', () => {
        console.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });

      // Create a channel for publishing
      this.publishChannel = await this.connection.createChannel();

      // Set up the exchange
      await this.publishChannel.assertExchange(
        this.config.exchange,
        this.config.exchangeType,
        { durable: true }
      );

      // Create a separate channel for consuming
      this.consumeChannel = await this.connection.createChannel();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;
      this.isConnected = true;
      logger.info(`Successfully connected to RabbitMQ as ${this.config.clientId}`);
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error.message);
      this.handleDisconnect();
      throw error;
    }
  }

  /**
   * Handle disconnection by scheduling a reconnect
   */
  handleDisconnect() {
    if (this.reconnectTimer) return;

    this.isConnected = false;
    this.connection = null;
    this.publishChannel = null;
    this.consumeChannel = null;
    this.consumerTag = null;

    // Increment reconnect attempts
    this.reconnectAttempts++;

    // Stop trying after max attempts
    if (this.reconnectAttempts > this.config.maxReconnectAttempts) {
      logger.error(`Maximum reconnect attempts (${this.config.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    // Calculate backoff time with exponential backoff
    const backoff = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    logger.info(`Scheduling reconnect in ${backoff}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();

        // If we were listening before, restart listening
        if (this.queueName) {
          await this.startListening({ queueName: this.queueName });
        }
      } catch (error) {
        logger.error('Reconnect failed:', error.message);
      }
    }, backoff);
  }

  /**
   * Publish a notification to the configured exchange
   * @param {string} type - Notification type (used as routing key)
   * @param {object} data - Notification data
   * @param {string} targetId - Optional target identifier
   * @param {object} options - Additional publishing options
   * @returns {Promise<boolean>} - Resolves to true if published successfully
   */
  async publishNotification(type, data, targetId = null, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      logger.info(`Preparing to publish notification of type ${type} to exchange ${this.config.exchange}`);

      const notification = {
        type,
        data,
        timestamp: new Date().toISOString(),
        publisher: this.config.clientId,
        id: this.generateId(),
        ...(targetId && { targetId })
      };

      // Use the notification type as the routing key
      const routingKey = options.routingKey || type;

      // Convert message to Buffer
      const message = Buffer.from(JSON.stringify(notification));

      // Publish the message
      const published = this.publishChannel.publish(
        this.config.exchange,
        routingKey,
        message,
        {
          persistent: true,
          messageId: notification.id,
          contentType: 'application/json',
          timestamp: Math.floor(Date.now() / 1000),
          appId: this.config.clientId,
          ...(targetId && { correlationId: targetId }),
          ...options.properties
        }
      );

      if (published) {
        logger.info(`Notification published to exchange ${this.config.exchange} with routing key ${routingKey}`);
        return true;
      } else {
        console.warn('Channel write buffer is full - applying back pressure');
        await new Promise(resolve => this.publishChannel.once('drain', resolve));
        logger.info('Channel write buffer drained, continuing');
        return true;
      }
    } catch (error) {
      logger.error(`Error publishing notification to exchange ${this.config.exchange}:`, error.message);

      // If we have a connection error, try to reconnect
      if (!this.isConnected || error.message.includes('channel closed')) {
        this.isConnected = false;
        await this.connect();

        // Retry the publish operation once
        return this.publishNotification(type, data, targetId, options);
      }

      throw error;
    }
  }

  /**
   * Register a handler for a specific notification type
   * @param {string} type - Notification type to handle (routing key pattern)
   * @param {function} handler - Handler function
   */
  registerHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.handlers.set(type, handler);
    logger.info(`Handler registered for notification type: ${type}`);
  }

  /**
   * Start listening for notifications
   * @param {object} options - Subscription options
   * @returns {Promise<void>} - Resolves when listening starts
   */
  async startListening(options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }

    // If we don't have any handlers, there's nothing to listen for
    if (this.handlers.size === 0) {
      console.warn('No handlers registered. Not starting listener.');
      return;
    }

    try {
      // Create a queue with a unique name for this consumer
      this.queueName = options.queueName ||
        `${this.config.queuePrefix}${this.config.clientId}-${this.generateId()}`;

      logger.info(`Creating queue: ${this.queueName}`);

      await this.consumeChannel.assertQueue(this.queueName, {
        exclusive: options.exclusive || false,
        durable: options.durable !== false,
        autoDelete: options.autoDelete || false
      });

      // Bind the queue to the exchange for each handler
      for (const [type] of this.handlers.entries()) {
        // Use the notification type as the routing key pattern
        const routingKey = type === '*' ? '#' : type;

        logger.info(`Binding queue ${this.queueName} to exchange ${this.config.exchange} with routing key ${routingKey}`);
        await this.consumeChannel.bindQueue(this.queueName, this.config.exchange, routingKey);
      }

      // Set prefetch count to control concurrency
      await this.consumeChannel.prefetch(options.prefetch || 10);

      // Start consuming messages
      logger.info(`Starting to consume messages from queue: ${this.queueName}`);
      const { consumerTag } = await this.consumeChannel.consume(this.queueName, async (message) => {
        if (!message) {
          console.warn('Consumer cancelled by server');
          return;
        }

        try {
          const content = message.content.toString();
          const parsedMessage = JSON.parse(content);
          const { type } = parsedMessage;

          logger.info(`Received notification of type: ${type}, routing key: ${message.fields.routingKey}`);

          const metadata = {
            routingKey: message.fields.routingKey,
            exchange: message.fields.exchange,
            deliveryTag: message.fields.deliveryTag,
            redelivered: message.fields.redelivered,
            properties: message.properties
          };

          // Find the appropriate handler
          let handler;
          if (this.handlers.has(type)) {
            handler = this.handlers.get(type);
          } else if (this.handlers.has('*')) {
            handler = this.handlers.get('*');
          }

          if (handler) {
            try {
              await handler(parsedMessage, metadata);
              // Acknowledge the message after successful processing
              this.consumeChannel.ack(message);
            } catch (handlerError) {
              logger.error(`Error in message handler for type ${type}:`, handlerError);
              // Reject the message and requeue it if handler failed
              this.consumeChannel.nack(message, false, true);
            }
          } else {
            logger.warn(`No handler registered for notification type: ${type}`);
            // Acknowledge the message even though we don't have a handler
            this.consumeChannel.ack(message);
          }
        } catch (error) {
          logger.error('Error processing message:', error);
          // Reject the message but don't requeue if it's a parsing error
          this.consumeChannel.nack(message, false, false);
        }
      }, { noAck: false });

      this.consumerTag = consumerTag;
      logger.info(`Started listening for notifications on exchange: ${this.config.exchange} with consumer tag: ${consumerTag}`);
    } catch (error) {
      logger.error(`Error setting up message consumer:`, error.message);

      // If we have a connection error, try to reconnect
      if (!this.isConnected || error.message.includes('channel closed')) {
        this.isConnected = false;
        await this.connect();

        // Retry the subscribe operation
        return this.startListening(options);
      }

      throw error;
    }
  }

  /**
   * Stop listening for notifications
   * @returns {Promise<void>} - Resolves when listening stops
   */
  async stopListening() {
    if (this.consumeChannel && this.consumerTag) {
      try {
        logger.info(`Cancelling consumer with tag: ${this.consumerTag}`);
        await this.consumeChannel.cancel(this.consumerTag);
        this.consumerTag = null;
        logger.info('Consumer cancelled');
      } catch (error) {
        logger.error('Error cancelling consumer:', error.message);
      }
    }
  }

  /**
   * Disconnect from RabbitMQ
   * @returns {Promise<void>} - Resolves when disconnected
   */
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Stop listening first
    await this.stopListening();

    if (this.connection) {
      try {
        if (this.publishChannel) {
          logger.info('Closing publish channel');
          await this.publishChannel.close();
          this.publishChannel = null;
        }

        if (this.consumeChannel) {
          logger.info('Closing consume channel');
          await this.consumeChannel.close();
          this.consumeChannel = null;
        }

        logger.info('Closing RabbitMQ connection');
        await this.connection.close();
        this.isConnected = false;
        logger.info('Disconnected from RabbitMQ');
      } catch (error) {
        logger.error('Error disconnecting from RabbitMQ:', error.message);
      } finally {
        this.connection = null;
      }
    }
  }

  /**
   * Handle SIGINT/SIGTERM signals for graceful shutdown
   */
  async handleSigInt() {
    logger.info('Received shutdown signal, closing RabbitMQ connections...');
    await this.disconnect();
    logger.info('RabbitMQ connections closed');
  }

  /**
   * Create a direct reply queue for request-reply pattern
   * @returns {Promise<Object>} - Object containing the queue and a method to send requests
   */
  async createReplyQueue() {
    if (!this.isConnected) {
      await this.connect();
    }

    // Create a channel specifically for this reply queue
    const replyChannel = await this.connection.createChannel();

    // Use the amq.rabbitmq.reply-to queue for direct replies
    const { queue: replyTo } = await replyChannel.assertQueue('', {
      exclusive: true,
      autoDelete: true
    });

    logger.info(`Created reply queue: ${replyTo}`);

    // Set up a consumer for the reply queue
    const responsePromises = new Map();

    await replyChannel.consume(replyTo, (message) => {
      if (!message) return;

      const correlationId = message.properties.correlationId;
      if (!correlationId) {
        console.warn('Received reply message without correlation ID');
        replyChannel.ack(message);
        return;
      }

      const resolver = responsePromises.get(correlationId);
      if (resolver) {
        try {
          const content = JSON.parse(message.content.toString());
          resolver.resolve(content);
        } catch (error) {
          resolver.reject(error);
        }
        responsePromises.delete(correlationId);
      } else {
        console.warn(`No pending request found for correlation ID: ${correlationId}`);
      }

      replyChannel.ack(message);
    }, { noAck: false });

    // Create a function to send requests
    const sendRequest = async (type, data, options = {}) => {
      const correlationId = this.generateId();

      // Create a promise that will be resolved when the reply is received
      const responsePromise = new Promise((resolve, reject) => {
        responsePromises.set(correlationId, { resolve, reject });

        // Set a timeout to reject the promise if no response is received
        const timeoutMs = options.timeout || 30000;
        const timeoutId = setTimeout(() => {
          if (responsePromises.has(correlationId)) {
            responsePromises.delete(correlationId);
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);

        // Store the timeout ID so we can clear it when the promise resolves
        responsePromises.get(correlationId).timeoutId = timeoutId;
      });

      // Send the request
      await this.publishNotification(type, data, null, {
        properties: {
          correlationId,
          replyTo,
          expiration: options.expiration || '30000' // 30 seconds
        },
        routingKey: options.routingKey || type
      });

      return responsePromise;
    };

    // Return the reply queue and the sendRequest function
    return {
      replyTo,
      sendRequest,
      close: async () => {
        // Clear all pending requests
        for (const [correlationId, { reject, timeoutId }] of responsePromises.entries()) {
          clearTimeout(timeoutId);
          reject(new Error('Reply queue closed'));
          responsePromises.delete(correlationId);
        }

        // Close the channel
        await replyChannel.close();
      }
    };
  }

  /**
   * Create a request handler for the request-reply pattern
   * @param {string} type - Request type to handle
   * @param {function} handler - Handler function that returns a response
   */
  async createRequestHandler(type, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this.isConnected) {
      await this.connect();
    }

    // Create a dedicated channel for this request handler
    const requestChannel = await this.connection.createChannel();

    // Create a queue for this request type
    const queueName = `${this.config.queuePrefix}request-${type}`;

    await requestChannel.assertQueue(queueName, {
      durable: true,
      autoDelete: false
    });

    // Bind the queue to the exchange
    await requestChannel.bindQueue(queueName, this.config.exchange, type);

    logger.info(`Created request handler for type: ${type} on queue: ${queueName}`);

    // Set prefetch count to control concurrency
    await requestChannel.prefetch(10);

    // Start consuming requests
    const { consumerTag } = await requestChannel.consume(queueName, async (message) => {
      if (!message) return;

      const replyTo = message.properties.replyTo;
      const correlationId = message.properties.correlationId;

      if (!replyTo || !correlationId) {
        console.warn(`Received request without replyTo or correlationId for type: ${type}`);
        requestChannel.ack(message);
        return;
      }

      try {
        const content = message.content.toString();
        const request = JSON.parse(content);

        logger.info(`Received request of type: ${type}, correlationId: ${correlationId}`);

        // Call the handler
        const response = await handler(request.data, {
          correlationId,
          properties: message.properties,
          routingKey: message.fields.routingKey
        });

        // Send the response
        requestChannel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify(response)),
          {
            correlationId,
            contentType: 'application/json',
            timestamp: Math.floor(Date.now() / 1000),
            appId: this.config.clientId
          }
        );

        requestChannel.ack(message);
      } catch (error) {
        logger.error(`Error handling request of type ${type}:`, error);

        // Send error response
        requestChannel.sendToQueue(
          replyTo,
          Buffer.from(JSON.stringify({
            error: true,
            message: error.message
          })),
          {
            correlationId,
            contentType: 'application/json'
          }
        );

        requestChannel.ack(message);
      }
    }, { noAck: false });

    logger.info(`Started request handler for type: ${type} with consumer tag: ${consumerTag}`);

    // Return a function to close the handler
    return {
      close: async () => {
        await requestChannel.cancel(consumerTag);
        await requestChannel.close();
        logger.info(`Closed request handler for type: ${type}`);
      }
    };
  }
}

module.exports = RabbitMQNotificationService;