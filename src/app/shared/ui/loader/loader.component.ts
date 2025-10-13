import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';              // 👈 importa NgIf

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [NgIf],                                   // 👈 agréga NgIf
  template: `
    <div class="fixed inset-0 grid place-items-center bg-black/30 z-50" *ngIf="visible()">
      <div class="rounded-2xl p-6 bg-white shadow-xl flex items-center gap-3">
        <span class="inline-block h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        <span class="font-medium">Cargando…</span>
      </div>
    </div>
  `,
})
export class LoaderComponent {
  private _visible = signal(false);
  visible = this._visible.asReadonly();
  show(){ this._visible.set(true); }
  hide(){ this._visible.set(false); }
}
