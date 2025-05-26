import { HttpHandlerFn, HttpRequest } from "@angular/common/http";
import { AuthService } from "./auth.service";
import { inject } from "@angular/core";

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  // Inject the current `AuthService` and use it to get an authentication token:
  const authService = inject(AuthService);
  const authToken = authService.getToken() as string;
  
  // Generate a unique trace ID for Zipkin
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  
  // Start with the original request
  let newReq = req.clone({
    headers: req.headers
      .append('X-B3-TraceId', traceId)
      .append('X-B3-SpanId', spanId)
      .append('X-B3-Sampled', '1')
  });
  
  // Add auth token if available
  if(authToken) {
    newReq = newReq.clone({
      headers: newReq.headers.append('Authorization', `Bearer ${authToken}`),
    });
  }
  
  return next(newReq);
}

// Helper function to generate a 16-character trace ID (64-bit hex string)
function generateTraceId(): string {
  return Math.random().toString(16).substring(2, 10) + 
         Math.random().toString(16).substring(2, 10);
}

// Helper function to generate an 8-character span ID (32-bit hex string)
function generateSpanId(): string {
  return Math.random().toString(16).substring(2, 10);
}