import { Injectable, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

type Theme = 'system'|'light'|'dark';
type Density = 'comfortable'|'compact';
type Lang = 'es'|'en';
type Settings = { language: Lang; theme: Theme; density: Density };

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private _settings = signal<Settings>({
    language: (localStorage.getItem('lang') as Lang) || 'es',
    theme: 'system',
    density: 'comfortable',
  });
  settings = this._settings.asReadonly();

  constructor(private i18n: I18nService) {
    // inicializa html[lang] para LanguageInterceptor
    document.documentElement.lang = this._settings().language;
    this.i18n.set(this._settings().language);
  }

  update(patch: Partial<Settings>) {
    const next = { ...this._settings(), ...patch };
    this._settings.set(next);
    if (patch.language) {
      this.i18n.set(next.language);
      localStorage.setItem('lang', next.language);
      document.documentElement.lang = next.language;
    }
    if (patch.theme) {
      const theme = next.theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const wantDark = theme === 'dark' || (theme === 'system' && prefersDark);
      document.documentElement.toggleAttribute('data-theme', wantDark);
      if (wantDark) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.setAttribute('data-theme', 'light');
    }
    if (patch.density) {
      document.documentElement.style.setProperty('--density', next.density);
    }
  }
}
