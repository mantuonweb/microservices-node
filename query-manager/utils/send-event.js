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

      // Add authorization header to the request config
      config.headers["authorization"] = headers.authorization;
      
      // Add B3 distributed tracing headers if they exist
      const tracingHeaders = [
        'x-b3-traceid',
        'x-b3-spanid',
        'x-b3-parentspanid',
        'x-b3-sampled',
        'x-b3-flags'
      ];
      
      tracingHeaders.forEach(header => {
        if (headers[header]) {
          config.headers[header] = headers[header];
        }
      });

      if (method) {
        if (method === 'get') {
          const response = await axios.get(`${serviceUrl}/${realm}`, config);
          return response.data;
        } else {
          const axiosMethod = axios[method];
          // Pass the event data for non-GET methods
          const response = await axiosMethod(`${serviceUrl}/${realm}`, event, config);
          return response.data;
        }
      } else {
        const response = await axios.post(`${serviceUrl}/${realm}`, event, config);
        return response.data;
      }
    } catch (error) {
      logger.error(`Error sending event to ${serviceId}/${realm}: ${error.message}`);
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
