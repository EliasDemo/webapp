import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private t = inject(TranslocoService);

  current() { return this.t.getActiveLang(); }

  set(lang: 'es' | 'en') {
    this.t.setActiveLang(lang);
    // Sincroniza con el DOM y localStorage para que el interceptor lea de aquí
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }

  translate(key: string, params?: any) {
    return this.t.translate(key, params);
  }
}
