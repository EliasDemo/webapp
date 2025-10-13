import { Injectable } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // omite assets y endpoints públicos
    if (req.url.includes('/assets/') || /\/auth\/(login|lookup)$/.test(req.url)) {
      return next.handle(req);
    }
    const token = localStorage.getItem('token');
    if (!token) return next.handle(req);

    return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
}
