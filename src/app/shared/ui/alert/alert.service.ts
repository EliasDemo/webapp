import { Injectable, signal } from '@angular/core';

export type AlertKind = 'info' | 'success' | 'warn' | 'error';
export interface AlertMsg { id: number; type: AlertKind; text: string; }

@Injectable({ providedIn: 'root' })
export class AlertService {
  private _messages = signal<AlertMsg[]>([]);
  readonly messages = this._messages.asReadonly();

  private push(type: AlertKind, text: string) {
    this._messages.update(v => [...v, { id: Date.now(), type, text }]);
    // autodesaparecer a los 4s
    setTimeout(() => this.removeLast(), 4000);
  }

  info(t: string)   { this.push('info', t); }
  success(t: string){ this.push('success', t); }
  warn(t: string)   { this.push('warn', t); }
  error(t: string)  { this.push('error', t); }

  remove(id: number){ this._messages.update(v => v.filter(m => m.id !== id)); }
  private removeLast(){ const v = this._messages(); v.length && this.remove(v[0].id); }
}
