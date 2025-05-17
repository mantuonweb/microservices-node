const CircuitBreaker = require('opossum');
const logger = require('../utils/logger');

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

/**
 * Higher-order function that wraps all methods of a controller class with circuit breakers
 * @param {Function} ControllerClass - The controller class to wrap
 * @param {Function} circuitBreakerFactory - Function that creates circuit breakers
 * @param {Array<string>} [excludeMethods=[]] - Array of method names to exclude from wrapping
 * @returns {Object} - Instance of the controller with methods wrapped in circuit breakers
 */
function withCircuitBreaker(ControllerClass, circuitBreakerFactory, excludeMethods = []) {
  // Create an instance of the controller
  const controller = new ControllerClass();
  
  // Get all method names from the prototype that are functions and not the constructor
  // and not in the excludeMethods array
  const methodsToWrap = Object.getOwnPropertyNames(ControllerClass.prototype)
    .filter(method => {
      return typeof ControllerClass.prototype[method] === 'function' && 
             method !== 'constructor' &&
             !excludeMethods.includes(method);
    });
  
  // Create circuit breakers for all methods except excluded ones
  methodsToWrap.forEach(method => {
    // Store the original method
    const originalMethod = controller[method];
    
    // Replace the method with a circuit breaker wrapped version
    controller[method] = circuitBreakerFactory(originalMethod.bind(controller));
  });
  
  return controller;
}

module.exports = {
  withCircuitBreaker,
  createCircuitBreaker
};