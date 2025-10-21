import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdApiService } from '../../data-access/ad-api.service';
import { Universidad } from '../../models/ad.models';

type SedeForm = { nombre: string; es_principal: boolean; esta_suspendida: boolean };

@Component({
  standalone: true,
  selector: 'app-sede-create-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './sedes-create.page.html',
  styleUrls: ['./sedes-create.page.scss'],
})
export class SedeCreatePage {
  private api = inject(AdApiService);
  private router = inject(Router);

  universidadId = signal<number | null>(null);
  form = signal<SedeForm>({ nombre: '', es_principal: false, esta_suspendida: false });

  loading = signal(false);
  error   = signal<string | null>(null);

  constructor() { void this.bootstrap(); }

  async bootstrap() {
    try {
      const u = await firstValueFrom(this.api.obtenerUniversidad());
      const uni = u.data as Universidad;
      this.universidadId.set(uni?.id ?? null);
    } catch {
      this.error.set('No se pudo leer la universidad');
    }
  }

  set<K extends keyof SedeForm>(k: K, v: SedeForm[K]) { this.form.update(f => ({ ...f, [k]: v })); }

  async guardar() {
    const uniId = this.universidadId();
    const f = this.form();
    if (!uniId) { this.error.set('Falta Universidad ID'); return; }
    if (!f.nombre.trim()) { this.error.set('Ingresa el nombre de la sede'); return; }

    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.crearSede({
        universidad_id: uniId,
        nombre: f.nombre.trim(),
        es_principal: f.es_principal,
        esta_suspendida: f.esta_suspendida,
      }));
      this.router.navigate(['/ad/sedes']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo crear la sede');
    } finally {
      this.loading.set(false);
    }
  }

  volver() { this.router.navigate(['/ad/sedes']); }
}
