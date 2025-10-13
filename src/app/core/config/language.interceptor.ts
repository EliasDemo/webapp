import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class LanguageInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Fuente “tonta”: primero <html lang>, si no hay, localStorage, si no, 'es'
    const docLang = document.documentElement.lang;
    const stored = localStorage.getItem('lang') as 'es' | 'en' | null;
    const lang = (docLang || stored || 'es');

    // Evita duplicar header si ya viene
    if (req.headers.has('Accept-Language')) {
      return next.handle(req);
    }

    return next.handle(
      req.clone({ setHeaders: { 'Accept-Language': lang } })
    );
  }
}
