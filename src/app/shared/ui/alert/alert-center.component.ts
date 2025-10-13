import { Component, inject } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { AlertService } from './alert.service';

@Component({
  selector: 'app-alert-center',
  standalone: true,
  imports: [NgFor, NgClass], // 👈 agrega NgClass
  template: `
  <div class="fixed top-4 right-4 z-[60] space-y-3 w-80">
    <div *ngFor="let m of alerts.messages()"
         class="rounded-xl p-4 shadow-lg flex items-start gap-3 border"
         [ngClass]="{
          'bg-blue-50 text-blue-900 border-blue-200': m.type==='info',
          'bg-green-50 text-green-900 border-green-200': m.type==='success',
          'bg-amber-50 text-amber-900 border-amber-200': m.type==='warn',
          'bg-red-50 text-red-900 border-red-200': m.type==='error'
         }">
      <div class="mt-0.5">⚑</div>
      <div class="text-sm">{{ m.text }}</div>
      <button class="ml-auto opacity-60 hover:opacity-100" (click)="alerts.remove(m.id)">✕</button>
    </div>
  </div>`,
})
export class AlertCenterComponent {
  alerts = inject(AlertService);
}
