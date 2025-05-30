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
    // Define Zipkin headers that should be propagated
    this.zipkinHeaders = [
      'x-b3-traceid',
      'x-b3-spanid',
      'x-b3-parentspanid',
      'x-b3-sampled',
      'x-b3-flags',
      'x-request-id',
      'x-ot-span-context'
    ];
  }

  async getServiceUrl(serviceId) {
    const env = process.env.NODE_ENV || 'local'
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
        ] = env === 'local' ? `http://localhost:${service.ServicePort}` : `http://${service.ServiceAddress}:${service.ServicePort}`;
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

  async sendEvent(serviceId, realm, event, headers, method) {
    try {
      const serviceUrl = await this.getServiceUrl(serviceId);
      console.log(`${serviceUrl}/${realm}`, 'serviceUrl');
      // Create config object with headers for axios
      const config = { headers: {} };

      // Add authorization header
      if (headers.authorization) {
        config.headers["authorization"] = headers.authorization;
      }
      
      // Forward Zipkin tracing headers if they exist
      this.zipkinHeaders.forEach(header => {
        const headerValue = headers[header] || headers[header.toLowerCase()];
        if (headerValue) {
          config.headers[header.toLowerCase()] = headerValue;
          logger.debug(`Forwarding tracing header: ${header}`);
        }
      });

      if (method) {
        const axiosMethod = axios[method];
        const response = await axiosMethod(`${serviceUrl}/${realm}`, event, config);
        return response.data;
      } else {
        const response = await axios.post(`${serviceUrl}/${realm}`, event, config);
        return response.data;
      }
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
