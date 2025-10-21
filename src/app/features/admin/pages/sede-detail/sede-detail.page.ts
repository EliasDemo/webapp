import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdApiService } from '../../data-access/ad-api.service';
import { Facultad, EscuelaProfesional, EscuelaProfesionalWithVig, Sede } from '../../models/ad.models';

type Grouped = { facultad: Facultad; escuelas: EscuelaProfesionalWithVig[]; };

@Component({
  standalone: true,
  selector: 'app-sede-detail-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './sede-detail.page.html',
  styleUrls: ['./sede-detail.page.scss'],
})
export class SedeDetailPage {
  private api = inject(AdApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sedeId = Number(this.route.snapshot.paramMap.get('id'));

  loading = signal(true);
  error   = signal<string | null>(null);

  sede = signal<Sede | null>(null);
  facultades = signal<Facultad[]>([]);
  escuelasAsignadas = signal<EscuelaProfesional[]>([]);

  grupos = computed<Grouped[]>(() => {
    const facById = new Map(this.facultades().map(f => [f.id, f]));
    const porFac = new Map<number, Grouped>();

    for (const ep of this.escuelasAsignadas()) {
      const fid = ep.facultad_id;
      const fac = facById.get(fid);
      if (!fac) continue;

      const pivot = (ep.sedes ?? []).find(s => s.id === this.sedeId)?.pivot ?? {};
      const ext: EscuelaProfesionalWithVig = {
        ...ep,
        _vigente_desde: pivot.vigente_desde ?? null,
        _vigente_hasta: pivot.vigente_hasta ?? null,
      };

      if (!porFac.has(fid)) porFac.set(fid, { facultad: fac, escuelas: [ext] });
      else porFac.get(fid)!.escuelas.push(ext);
    }

    return Array.from(porFac.values())
      .sort((a, b) => a.facultad.nombre.localeCompare(b.facultad.nombre))
      .map(g => ({ facultad: g.facultad, escuelas: g.escuelas.sort((a, b) => a.nombre.localeCompare(b.nombre)) }));
  });

  constructor() {
    if (!this.sedeId || Number.isNaN(this.sedeId)) {
      this.router.navigate(['/ad/sedes']);
      return;
    }
    void this.cargarTodo();
  }

  async cargarTodo() {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.cargarSede();
      await this.cargarFacultades();
      await this.cargarEscuelasAsignadas(); // usando ?sede_id=...
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Error al cargar el detalle de la sede');
    } finally {
      this.loading.set(false);
    }
  }

  private async cargarSede() {
    const res = await firstValueFrom(this.api.obtenerSede(this.sedeId));
    this.sede.set(res.data as Sede);
  }

  private async cargarFacultades() {
    const res = await firstValueFrom(this.api.listarFacultades(undefined, 1, 500));
    this.facultades.set(res.data?.items ?? []);
  }

  private async cargarEscuelasAsignadas() {
    // el backend ya filtra por sede_id y devuelve el pivot de esa sede
    const res = await firstValueFrom(this.api.listarEscuelas(undefined, 1, 500, this.sedeId));
    this.escuelasAsignadas.set(res.data?.items ?? []);
  }

  async desvincular(escuela: EscuelaProfesional) {
    try {
      await firstValueFrom(this.api.detachEscuelaFromSede(escuela.id, this.sedeId));
      await this.cargarEscuelasAsignadas();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo desvincular la escuela');
    }
  }

  async actualizarVigencia(escuela: EscuelaProfesional, desde: string | null, hasta: string | null) {
    try {
      await firstValueFrom(this.api.updateEscuelaSedeVigencia(escuela.id, this.sedeId, {
        vigente_desde: desde ?? undefined,
        vigente_hasta: hasta ?? undefined,
      }));
      await this.cargarEscuelasAsignadas();
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo actualizar la vigencia');
    }
  }

  editarVigenciaClick(ep: EscuelaProfesionalWithVig) {
    const pDesde = (ep as any)._vigente_desde ?? (ep.sedes ?? []).find(s => s.id === this.sedeId)?.pivot?.vigente_desde ?? '';
    const pHasta = (ep as any)._vigente_hasta ?? (ep.sedes ?? []).find(s => s.id === this.sedeId)?.pivot?.vigente_hasta ?? '';

    const d = window.prompt('Nueva fecha desde (YYYY-MM-DD) o vacío para mantener', pDesde);
    const h = window.prompt('Nueva fecha hasta (YYYY-MM-DD) o vacío para mantener', pHasta);

    const desde = d === '' ? null : (d ?? null);
    const hasta = h === '' ? null : (h ?? null);
    void this.actualizarVigencia(ep as EscuelaProfesional, desde, hasta);
  }

  irAsignar() {
    this.router.navigate(['/ad/sedes', this.sedeId, 'asignar-ep']);
  }

  trackByGrupo = (_: number, g: Grouped) => g.facultad.id;
  trackByEscuela = (_: number, ep: EscuelaProfesional) => ep.id;

  volver() { this.router.navigate(['/ad/sedes']); }
}
