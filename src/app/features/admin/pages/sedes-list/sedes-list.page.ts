import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdApiService } from '../../data-access/ad-api.service';
import { Facultad, EscuelaProfesional, Sede } from '../../models/ad.models';

@Component({
  standalone: true,
  selector: 'app-sedes-list-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './sedes-list.page.html',
  styleUrls: ['./sedes-list.page.scss'],
})
export class SedesListPage {
  private api = inject(AdApiService);
  private router = inject(Router);

  // sedes
  loading = signal(true);
  error   = signal<string | null>(null);
  sedes   = signal<Sede[]>([]);
  q       = signal('');

  // catálogo académico global (footer)
  facs    = signal<Facultad[]>([]);
  epsAll  = signal<EscuelaProfesional[]>([]);
  facFilterId = signal<number | null>(null);

  // derivados
  filtered = computed(() => {
    const term = this.q().toLowerCase().trim();
    return term ? this.sedes().filter(x => x.nombre.toLowerCase().includes(term)) : this.sedes();
  });

  escuelasFiltradas = computed(() => {
    const fid = this.facFilterId();
    const all = this.epsAll();
    return fid ? all.filter(e => e.facultad_id === fid) : all;
  });

  conteoEpsPorFac = computed(() => {
    const map = new Map<number, number>();
    for (const e of this.epsAll()) {
      map.set(e.facultad_id, (map.get(e.facultad_id) ?? 0) + 1);
    }
    return map;
  });

  constructor() { void this.bootstrap(); }

  async bootstrap() {
    await Promise.all([this.cargarSedes(), this.cargarCatalogo()]);
  }

  async cargarSedes(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.listarSedes(this.q() || undefined, 1, 200));
      const items = res.data?.items ?? [];
      this.sedes.set(items);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Error al cargar las sedes');
    } finally {
      this.loading.set(false);
    }
  }

  async cargarCatalogo(): Promise<void> {
    try {
      const [rf, re] = await Promise.all([
        firstValueFrom(this.api.listarFacultades(undefined, 1, 500)),
        firstValueFrom(this.api.listarEscuelas(undefined, 1, 500)),
      ]);
      this.facs.set(rf.data?.items ?? []);
      this.epsAll.set(re.data?.items ?? []);
    } catch (e) {
      // catálogo es auxiliar; no bloquea la vista
    }
  }

  handleSearch() { void this.cargarSedes(); }

  async handleClear() {
    this.q.set('');
    await this.cargarSedes();
  }

  onFacFilterChange(val: number | null) {
    this.facFilterId.set(val === null ? null : Number(val));
  }

  goToView(sede: Sede, evt: Event) {
    evt.preventDefault();
    this.router.navigate(['/ad/sedes', sede.id]);
  }

  goToCreate() {
    this.router.navigate(['/ad/sedes', 'nueva']);
  }

  goToCreateFac() {
    this.router.navigate(['/ad/facultades/nueva']);
  }

  goToCreateEp() {
    this.router.navigate(['/ad/escuelas-profesionales/nueva']);
  }

  goToAssign(sede: Sede) {
    this.router.navigate(['/ad/sedes', sede.id, 'asignar-ep']);
  }

  trackById = (_: number, s: Sede) => s.id;
  trackByFac = (_: number, f: Facultad) => f.id;
  trackByEp = (_: number, e: EscuelaProfesional) => e.id;
}
