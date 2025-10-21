import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdApiService } from '../../data-access/ad-api.service';
import { Facultad, EscuelaProfesional, Sede } from '../../models/ad.models';

@Component({
  standalone: true,
  selector: 'app-assign-ep-sede-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-ep-sede.page.html',
  styleUrls: ['./assign-ep-sede.page.scss'],
})
export class AssignEpSedePage {
  private api   = inject(AdApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sedeId = Number(this.route.snapshot.paramMap.get('id'));

  loading = signal(false);
  error   = signal<string | null>(null);

  sede = signal<Sede | null>(null);
  facs = signal<Facultad[]>([]);

  // búsqueda
  q = signal('');
  resultados = signal<EscuelaProfesional[]>([]);
  facFilterId = signal<number | null>(null);

  // selección
  selectedId = signal<number | null>(null);
  selectedName = signal<string | null>(null);
  desde = signal<string | null>(null);
  hasta = signal<string | null>(null);

  resultadosFiltrados = computed(() => {
    const fid = this.facFilterId();
    const base = this.resultados();
    return fid ? base.filter(r => r.facultad_id === fid) : base;
  });

  constructor() { void this.bootstrap(); }

  async bootstrap() {
    if (!this.sedeId || Number.isNaN(this.sedeId)) {
      this.router.navigate(['/ad/sedes']);
      return;
    }
    try {
      const [s, rf] = await Promise.all([
        firstValueFrom(this.api.obtenerSede(this.sedeId)),
        firstValueFrom(this.api.listarFacultades(undefined, 1, 500)),
      ]);
      this.sede.set(s.data as Sede);
      this.facs.set(rf.data?.items ?? []);
    } catch (e) {
      // no critical
    }
  }

  onFacFilterChange(val: number | null) {
    this.facFilterId.set(val === null ? null : Number(val));
  }

  async buscar() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.listarEscuelas(this.q().trim() || undefined, 1, 50));
      this.resultados.set(res.data?.items ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo buscar');
    } finally {
      this.loading.set(false);
    }
  }

  seleccionar(ep: EscuelaProfesional) {
    this.selectedId.set(ep.id);
    this.selectedName.set(ep.nombre);
  }

  async guardar() {
    const id = this.selectedId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.attachSedeToEscuela(id, {
        sede_id: this.sedeId,
        vigente_desde: this.desde() ?? null,
        vigente_hasta: this.hasta() ?? null,
      }));
      this.router.navigate(['/ad/sedes', this.sedeId]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo asignar la escuela a la sede');
    } finally {
      this.loading.set(false);
    }
  }

  volver() {
    this.router.navigate(['/ad/sedes', this.sedeId]);
  }

  trackByFac = (_: number, f: Facultad) => f.id;
  trackByEp  = (_: number, e: EscuelaProfesional) => e.id;
}
