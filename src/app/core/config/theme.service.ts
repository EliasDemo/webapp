import { Injectable, signal, effect } from '@angular/core';
export type Theme = 'light'|'dark'|'system';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private media = window.matchMedia('(prefers-color-scheme: dark)');
  private _choice = signal<Theme>((localStorage.getItem('theme') as Theme) || 'system');
  private _effective = signal<'light'|'dark'>(this.compute());
  constructor(){
    this.media.addEventListener('change', () => this.update());
    effect(() => { localStorage.setItem('theme', this._choice()); this.update(); });
  }
  choice(){ return this._choice(); } effective(){ return this._effective(); } set(v:Theme){ this._choice.set(v); }
  private compute(){ const c=this._choice(); return c==='system' ? (this.media.matches?'dark':'light') : c; }
  private update(){ this._effective.set(this.compute()); document.documentElement.setAttribute('data-theme', this._effective()); }
}
