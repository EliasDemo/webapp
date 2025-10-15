import { Injectable, NgZone, inject, signal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'welcome';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface ToastConfig {
  duration?: number;               // ms
  text?: string;
  type?: ToastType;
  icon?: string;                   // clase CSS del icono (ej. 'fa-solid fa-bolt')
  action?: ToastAction | null;
}

@Injectable({ providedIn: 'root' })
export class FooterToastService {
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private zone = inject(NgZone);

  // señales internas
  private _visible  = signal(false);
  private _text     = signal<string>('Sé íntegro, sé misionero y sé innovador');
  private _type     = signal<ToastType>('welcome');
  private _icon     = signal<string>('fa-solid fa-bolt');
  private _action   = signal<ToastAction | null>(null);
  private _duration = signal<number>(5000);

  // solo lectura hacia fuera
  readonly visible  = this._visible.asReadonly();
  readonly text     = this._text.asReadonly();
  readonly type     = this._type.asReadonly();
  readonly icon     = this._icon.asReadonly();
  readonly action   = this._action.asReadonly();
  readonly duration = this._duration.asReadonly();

  show(cfg: ToastConfig | number = 5000, text?: string, type?: ToastType) {
    // Soporta show({ ... }) y show(ms, text?, type?)
    const asConfig: ToastConfig = typeof cfg === 'number'
      ? { duration: cfg, text, type }
      : cfg;

    // valores por defecto
    const t: ToastType = asConfig.type ?? 'welcome';

    this._text.set(asConfig.text ?? this._text());
    this._type.set(t);
    this._icon.set(asConfig.icon ?? this.iconFor(t));
    this._action.set(asConfig.action ?? null);
    this._duration.set(asConfig.duration ?? 5000);
    this._visible.set(true);

    // reinicia timer
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    const ms = this._duration();
    if (ms > 0) {
      this.zone.runOutsideAngular(() => {
        this.hideTimer = setTimeout(() => {
          this.zone.run(() => this.hide());
        }, ms);
      });
    }
  }

  hide() {
    this._visible.set(false);
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  showWelcome(durationMs = 5000) {
    this.show({ duration: durationMs, type: 'welcome' });
  }

  /** Mostrar una sola vez cada X días (persistencia local) */
  showOnce(key: string, cfg: ToastConfig = {}, days = 1) {
    try {
      const now = Date.now();
      const exp = Number(localStorage.getItem(key) || 0);
      if (exp && now < exp) return;
      this.show(cfg);
      localStorage.setItem(key, String(now + days * 86400000));
    } catch { /* no-op en SSR / privados */ }
  }

  private iconFor(type: ToastType): string {
    const map = {
      welcome: 'fa-solid fa-bolt',
      success: 'fa-solid fa-check',
      error:   'fa-solid fa-triangle-exclamation',
      warning: 'fa-solid fa-circle-exclamation',
      info:    'fa-solid fa-circle-info',
    } as const;
    return map[type] ?? map['welcome'];
  }
}
