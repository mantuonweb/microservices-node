const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

const circuitBreakerOptions = {
  timeout: 3000, // Time in milliseconds to wait for response
  errorThresholdPercentage: 50, // Error percentage to trip the circuit
  resetTimeout: 30000, // Time in milliseconds to reset the circuit
};

const createCircuitBreaker = (requestHandler) => {
  const breaker = new CircuitBreaker(requestHandler, circuitBreakerOptions);

  breaker.on('success', () => {
    logger.info('Circuit Breaker: Request successful');
  });

  breaker.on('timeout', () => {
    logger.warn('Circuit Breaker: Request timeout');
  });

  breaker.on('reject', () => {
    logger.warn('Circuit Breaker: Request rejected (circuit open)');
  });

  breaker.on('open', () => {
    logger.warn('Circuit Breaker: Circuit opened');
  });

  breaker.on('halfOpen', () => {
    logger.info('Circuit Breaker: Circuit half-opened');
  });

  breaker.on('close', () => {
    logger.info('Circuit Breaker: Circuit closed');
  });

  return breaker;
};

module.exports = createCircuitBreaker;
