import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { provideTransloco, TranslocoConfig, TranslocoLoader, Translation } from '@jsverse/transloco';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HttpTranslocoLoader implements TranslocoLoader {
  private http = inject(HttpClient);
  getTranslation(lang: string): Observable<Translation> {
    // 👇 sin slash inicial
    return this.http.get<Translation>(`assets/i18n/${lang}/common.json`);
  }
}

const CONFIG: TranslocoConfig = {
  availableLangs: ['es', 'en'],
  defaultLang: 'es',
  fallbackLang: 'es',         // 👈 agrega un fallback
  scopes: {},
  reRenderOnLangChange: true,
  prodMode: true,
  flatten: { aot: true },
  failedRetries: 0,
  interpolation: ['{{','}}'],
  missingHandler: {
    logMissingKey: true,
    useFallbackTranslation: true,
    allowEmpty: false
  }
};

export const provideI18n = [
  provideTransloco({ config: CONFIG, loader: HttpTranslocoLoader }),
];
