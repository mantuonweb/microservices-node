const CircuitBreaker = require('opossum');
const logger = require('./logger');

const circuitBreakerConfig = {
  timeout: 3000, // Time in milliseconds to wait for response
  errorThresholdPercentage: 50, // Error percentage to trip the circuit
  resetTimeout: 30000, // Time in milliseconds to wait before resetting the circuit
  volumeThreshold: 10, // Minimum number of requests before tripping circuit
};

function createCircuitBreaker(asyncFunction, options = {}) {
  const breaker = new CircuitBreaker(asyncFunction, {
    ...circuitBreakerConfig,
    ...options,
  });

  breaker.on('success', () => {
    logger.info('Circuit Breaker: Operation successful');
  });

  breaker.on('timeout', () => {
    logger.warn('Circuit Breaker: Operation timed out');
  });

  breaker.on('reject', () => {
    logger.warn('Circuit Breaker: Circuit is open, request rejected');
  });

  breaker.on('open', () => {
    logger.error('Circuit Breaker: Circuit opened - service is unavailable');
  });

  breaker.on('halfOpen', () => {
    logger.info('Circuit Breaker: Circuit is half-open, testing service');
  });

  breaker.on('close', () => {
    logger.info('Circuit Breaker: Circuit closed - service is available');
  });

  return breaker;
}

module.exports = createCircuitBreaker;
