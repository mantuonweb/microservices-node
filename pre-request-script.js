// Generate a random 64-bit trace ID (16 hex characters)
function generateTraceId() {
    let traceId = '';
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < 16; i++) {
        traceId += hexChars.charAt(Math.floor(Math.random() * 16));
    }
    return traceId;
}

// Generate a random 64-bit span ID (16 hex characters)
function generateSpanId() {
    let spanId = '';
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < 16; i++) {
        spanId += hexChars.charAt(Math.floor(Math.random() * 16));
    }
    return spanId;
}

// Generate Zipkin headers
const traceId = generateTraceId();
const spanId = generateSpanId();
const parentSpanId = null; // Set to null for the first span or provide a parent span ID

// Set the Zipkin headers
pm.request.headers.add({ key: 'X-B3-TraceId', value: traceId });
pm.request.headers.add({ key: 'X-B3-SpanId', value: spanId });

// Only add parent span ID if it exists
if (parentSpanId) {
    pm.request.headers.add({ key: 'X-B3-ParentSpanId', value: parentSpanId });
}

// Set sampling to 1 to ensure the trace is recorded
pm.request.headers.add({ key: 'X-B3-Sampled', value: '1' });

// Optional: Log the generated IDs for debugging
console.log('Generated Zipkin headers:');
console.log('X-B3-TraceId:', traceId);
console.log('X-B3-SpanId:', spanId);