const axios = require('axios');
const logger = require('./logger');
const Consul = require('consul');

class EventSender {
  constructor() {
    this.defaultEventServiceUrl = {};
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || 8500,
      promisify: true,
    });
    this.eventServiceUrl = {};
  }

  async getEventServiceUrl(serviceId) {
    console.log(this.eventServiceUrl, serviceId, 'serviceId');
    if (this.eventServiceUrl[serviceId]) {
      return this.eventServiceUrl[serviceId];
    }

    try {
      // Try to get the service details from Consul using service ID
      const services = await this.consul.catalog.service.nodes(serviceId);
      if (services && services.length > 0) {
        const service = services[0];
        // Construct URL from service address and port
        this.eventServiceUrl[
          serviceId
        ] = `http://${service.ServiceAddress}:${service.ServicePort}`;
        logger.info(
          `Retrieved event service URL from Consul: ${this.eventServiceUrl[serviceId]}`
        );
        return this.eventServiceUrl?.[serviceId];
      }
    } catch (error) {
      logger.warn(
        `Failed to retrieve event service from Consul: ${error.message}`
      );
    }

    // Fall back to default URL if Consul lookup fails
    logger.info(
      `Using default event service URL: ${this.defaultEventServiceUrl}`
    );
    this.eventServiceUrl = this.defaultEventServiceUrl;
    return this.eventServiceUrl;
  }

  async sendEvent(serviceId, realm, event) {
    try {
      const serviceUrl = await this.getEventServiceUrl(serviceId);
      const response = await axios.post(`${serviceUrl}/${realm}`, event);
      return response.data;
    } catch (error) {
      logger.error('Error sending event');
      throw error;
    }
  }

  // Singleton implementation
  static getInstance(options) {
    if (!EventSender.instance) {
      EventSender.instance = new EventSender(options);
    }
    return EventSender.instance;
  }
}

// Also export the class for testing or specialized use cases
module.exports = EventSender;
