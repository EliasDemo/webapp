import { Injectable, inject, signal } from '@angular/core';
import { APP_DEFAULTS, UserSettings } from './app-config.tokens';
@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private defaults = inject(APP_DEFAULTS);
  private _settings = signal<UserSettings>({ ...this.defaults, ...this.fromLocal() });
  settings(){ return this._settings(); }
  patch(p: Partial<UserSettings>){ const n={...this._settings(), ...p}; this._settings.set(n); localStorage.setItem('settings', JSON.stringify(n)); }
  private fromLocal(){ try{ return JSON.parse(localStorage.getItem('settings')||'{}'); }catch{ return {}; } }
}
