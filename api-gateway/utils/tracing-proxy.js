const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Creates a proxy middleware with Zipkin tracing support
 * 
 * @param {Object} tracer - Zipkin tracer instance
 * @param {Object} options - Proxy middleware options
 * @param {string} options.target - Target URL to proxy to
 * @param {Object} options.pathRewrite - Path rewriting rules
 * @returns {Function} Express middleware function
 */
function createTracingProxy(tracer, options) {
  const { target, pathRewrite, ...otherOptions } = options;
  
  return createProxyMiddleware({
    target,
    pathRewrite,
    changeOrigin: true,
    ...otherOptions,
    onProxyReq: (proxyReq, req, res) => {
      // Get the current trace context
      const currentContext = tracer.currentCtx();
      if (currentContext) {
        // Extract trace ID and propagate it
        const traceId = currentContext.traceId;
        if (traceId) {
          // Add Zipkin headers to the proxied request
          proxyReq.setHeader('X-B3-TraceId', traceId.traceId);
          proxyReq.setHeader('X-B3-SpanId', traceId.spanId);
          proxyReq.setHeader('X-B3-ParentSpanId', traceId.parentId || '');
          proxyReq.setHeader('X-B3-Sampled', traceId.sampled ? '1' : '0');
        }
      }
      
      // Call the original onProxyReq if provided
      if (options.onProxyReq) {
        options.onProxyReq(proxyReq, req, res);
      }
    }
  });
}

module.exports = { createTracingProxy };