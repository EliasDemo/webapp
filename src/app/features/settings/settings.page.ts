// src/app/features/settings/settings.page.ts
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfigService } from '../../core/config/config.service';

@Component({
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <h1 class="text-xl font-semibold mb-4">{{ 'app.settings' | transloco }}</h1>
    <div class="space-y-4">
      <div>
        <label class="block mb-1">{{ 'app.language' | transloco }}</label>
        <select class="border rounded px-2 py-1"
                [value]="cfg.settings().language"
                (change)="onLangChange($event)">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>

      <div>
        <label class="block mb-1">{{ 'app.theme' | transloco }}</label>
        <select class="border rounded px-2 py-1"
                [value]="cfg.settings().theme"
                (change)="onThemeChange($event)">
          <option value="system">{{ 'app.system' | transloco }}</option>
          <option value="light">{{ 'app.light' | transloco }}</option>
          <option value="dark">{{ 'app.dark' | transloco }}</option>
        </select>
      </div>

      <div>
        <label class="block mb-1">{{ 'app.density' | transloco }}</label>
        <select class="border rounded px-2 py-1"
                [value]="cfg.settings().density"
                (change)="onDensityChange($event)">
          <option value="comfortable">{{ 'app.comfortable' | transloco }}</option>
          <option value="compact">{{ 'app.compact' | transloco }}</option>
        </select>
      </div>
    </div>
  `
})
export class SettingsPage {
  cfg = inject(ConfigService);

  onLangChange(e: Event)    { this.cfg.update({ language: (e.target as HTMLSelectElement).value as 'es'|'en' }); }
  onThemeChange(e: Event)   { this.cfg.update({ theme: (e.target as HTMLSelectElement).value as 'system'|'light'|'dark' }); }
  onDensityChange(e: Event) { this.cfg.update({ density: (e.target as HTMLSelectElement).value as 'comfortable'|'compact' }); }
}
