require('dotenv').config({ path: './customer-service.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Consul = require('consul');
const logger = require('./utils/logger');
const configureApp = require('./config/App');

class CustomerService {
  constructor() {
    const { app, PORT } = configureApp();
    this.app = app;
    this.port = PORT;
    this.SERVICE_NAME = 'customer-service';
    this.serviceId = `${this.SERVICE_NAME}-${this.port}`;
    this.consul = null;
    this.server = null;
    this.CONSUL_ENABLED = process.env.CONSUL_ENABLED !== 'false';
    
    this.initializeConsul();
    this.configureMiddleware();
    this.setupShutdownHandlers();
  }

  initializeConsul() {
    if (this.CONSUL_ENABLED) {
      try {
        this.consul = new Consul({
          host: process.env.CONSUL_HOST || 'localhost',
          port: process.env.CONSUL_PORT || 8500,
          promisify: true,
        });
        logger.info('Consul client initialized');
      } catch (error) {
        logger.error('Failed to initialize Consul client:', error.message);
      }
    } else {
      logger.info('Consul integration disabled by configuration');
    }
  }

  configureMiddleware() {
    this.app.use(express.json());
    this.app.use(cors());
  }

  registerService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      logger.info('Skipping Consul registration (disabled or not connected)');
      return;
    }

    try {
      this.consul.agent.service.register(
        {
          id: this.serviceId,
          name: this.SERVICE_NAME,
          address: process.env.SERVICE_HOST || 'localhost',
          port: parseInt(this.port),
          tags: ['microservice', 'customer'],
          check: {
            http: `http://${process.env.SERVICE_HOST || 'localhost'}:${this.port}/health`,
            interval: '15s',
            timeout: '5s',
          },
        },
        (err) => {
          if (err) {
            logger.error('Failed to register service with Consul:', err);
            return;
          }
          logger.info(`Service registered with Consul: ${this.serviceId}`);
        }
      );
    } catch (error) {
      logger.error('Error connecting to Consul:', error.message);
      logger.info('Service will run without Consul registration');
    }
  }

  deregisterService() {
    if (!this.consul || !this.CONSUL_ENABLED) {
      return;
    }

    this.consul.agent.service.deregister(this.serviceId, (err) => {
      if (err) {
        logger.error('Failed to deregister service from Consul:', err);
        return;
      }
      logger.info(`Service deregistered from Consul: ${this.serviceId}`);
    });
  }

  setupShutdownHandlers() {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  shutdown(signal) {
    logger.info(`${signal} signal received: shutting down...`);
    this.deregisterService();
    
    if (this.server) {
      this.server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    } else {
      process.exit(0);
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Customer Service running on port ${this.port}`);
      this.registerService();
    });
  }
}

// Create and start the service
const customerService = new CustomerService();
customerService.start();
