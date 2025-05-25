const { Tracer, BatchRecorder, jsonEncoder: { JSON_V2 } } = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const { HttpLogger } = require('zipkin-transport-http');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

class ZipkinHelper {
    constructor(serviceName) {
        this.serviceName = serviceName;
    }

    initialize(app) {
        try {
            // Initialize Zipkin
            const zipkinUrl = process.env.ZIPKIN_URL || 'http://localhost:9411';
            const recorder = new BatchRecorder({
                logger: new HttpLogger({
                    endpoint: `${zipkinUrl}/api/v2/spans`,
                    jsonEncoder: JSON_V2
                })
            });

            const ctxImpl = new CLSContext('zipkin');
            this.tracer = new Tracer({ 
                ctxImpl, 
                recorder, 
                localServiceName: this.serviceName 
            });

            // Add Zipkin middleware
            app.use(zipkinMiddleware({ tracer: this.tracer }));
            console.log('Zipkin initialized successfully');
            
            return this.tracer;
        } catch (error) {
            console.error('Error initializing Zipkin:', error);
            return null;
        }
    }

    getTracer() {
        return this.tracer;
    }
}

module.exports = ZipkinHelper;