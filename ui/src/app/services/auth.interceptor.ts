import { HttpHandlerFn, HttpRequest } from "@angular/common/http";
import { AuthService } from "./auth.service";
import { inject } from "@angular/core";

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  // Inject the current `AuthService` and use it to get an authentication token:
  const authToken = inject(AuthService).getToken() as string;
  // Clone the request to add the authentication header.
  if(authToken) {
    const newReq = req.clone({
      headers: req.headers.append('Authorization',    `Bearer ${authToken}`),
    });
    return next(newReq);
  }
  return next(req);
}