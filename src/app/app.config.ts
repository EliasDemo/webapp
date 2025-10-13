// src/app/app.config.ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, HTTP_INTERCEPTORS, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { provideI18n } from './core/i18n/i18n.module';
import { API_URL } from './core/tokens/api-url.token';

import { LanguageInterceptor } from './core/config/language.interceptor';
import { AuthInterceptor } from './core/http/auth.interceptor';
import { LoadingInterceptor } from './core/http/loading.interceptor';
import { ErrorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),

    // HttpClient + interceptores DI
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: LanguageInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor,     multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor,  multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor,    multi: true },

    // Config
    { provide: API_URL, useValue: '/api' },
    // Angular Material
    provideAnimations(),

    // i18n (Transloco)
    ...provideI18n,
  ],
};
