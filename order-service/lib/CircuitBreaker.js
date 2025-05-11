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

module.exports = withCircuitBreaker;