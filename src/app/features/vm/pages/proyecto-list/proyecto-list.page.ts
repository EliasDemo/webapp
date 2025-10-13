import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { VmApiService } from '../../data-access/vm.api';
import { VmProyecto, isApiOk, TipoProyecto } from '../../models/proyecto.models';
import { ProyectoCardComponent } from '../../components/proyecto-card/proyecto-card.component';

// 👇 NEW
import { LookupsApiService } from '../../lookups/lookups.api';

type PeriodoOpt = { id: number; anio: number; ciclo: string; estado?: string };
type TipoFiltro = 'ALL' | TipoProyecto;

@Component({
  standalone: true,
  selector: 'app-proyecto-list-page',
  imports: [CommonModule, RouterLink, FormsModule, ProyectoCardComponent],
  templateUrl: './proyecto-list.page.html'
})
export class ProyectoListPage {
  private api = inject(VmApiService);
  private lookups = inject(LookupsApiService); // 👈 NEW

  // estado
  loading = signal(true);
  items = signal<VmProyecto[]>([]);
  q = signal('');

  // Lookups de periodos y selección
  periodos = signal<PeriodoOpt[]>([]);
  selectedPeriodoId = signal<number | 'ALL' | null>(null);
  defaultPeriodoId = signal<number | null>(null); // periodo "actual" detectado

  // Filtro por tipo
  tipo = signal<TipoFiltro>('ALL'); // 'ALL' | 'LIBRE' | 'VINCULADO'

  constructor() {
    this.loadPeriodosYPrimeraCarga();
  }

  // Lista filtrada en memoria (además del filtro en servidor para periodo/tipo)
  filtered = computed(() => {
    let r = this.items();

    // Filtro por periodo (defensivo si el backend no filtrara)
    const sel = this.selectedPeriodoId();
    if (sel && sel !== 'ALL') {
      r = r.filter(p => p.periodo_id === sel);
    }

    // Filtro por tipo (en cliente por si el backend aún no lo soporta)
    const t = this.tipo();
    if (t !== 'ALL') {
      r = r.filter(p => p.tipo === t);
    }

    // Search
    const term = this.q().toLowerCase();
    if (term) {
      r = r.filter(p =>
        (p.titulo?.toLowerCase() ?? '').includes(term) ||
        (p.codigo ?? '').toLowerCase().includes(term)
      );
    }
    return r;
  });

  hasActiveFilters = computed(() => {
    const sel = this.selectedPeriodoId();
    return !!this.q()
      || (this.tipo() !== 'ALL')
      || (!!sel && sel !== this.defaultPeriodoId());
  });

  // acciones UI
  async handleSearch() {
    const sel = this.selectedPeriodoId();
    const tipo = this.tipo();
    await this.fetchData(this.q(), sel === 'ALL' ? undefined : (sel as number), tipo === 'ALL' ? undefined : tipo);
  }

  async handleClear() {
    this.q.set('');
    this.tipo.set('ALL');
    this.selectedPeriodoId.set(this.defaultPeriodoId()); // vuelve al periodo "actual"
    await this.fetchData(undefined, this.defaultPeriodoId() ?? undefined, undefined);
  }

  onPeriodoChange(v: any) {
    // <select> devuelve string; lo normalizamos
    if (v === 'ALL') this.selectedPeriodoId.set('ALL');
    else this.selectedPeriodoId.set(Number(v) || null);
  }

  onTipoChange(v: any) {
    this.tipo.set((v as TipoFiltro) ?? 'ALL');
  }

  async onDelete(id: number) {
    const p = this.items().find(x => x.id === id);
    if (!p || p.estado !== 'PLANIFICADO') return;
    if (!confirm(`¿Eliminar el proyecto "${p.titulo}"?`)) return;
    await firstValueFrom(this.api.eliminarProyecto(id));
    this.items.set(this.items().filter(x => x.id !== id));
  }

  // data
  private async loadPeriodosYPrimeraCarga() {
    try {
      // 1) Traer periodos activos y detectar "actual"
      const periodos = await firstValueFrom(this.lookups.fetchPeriodos('', true, 50));
      this.periodos.set(periodos);

      // Heurística: preferir EN_CURSO; si no, PLANIFICADO; si no, el primero
      const actual =
        periodos.find(p => p.estado === 'EN_CURSO')
        ?? periodos.find(p => p.estado === 'PLANIFICADO')
        ?? periodos[0];

      const actualId = actual?.id ?? null;
      this.defaultPeriodoId.set(actualId);
      this.selectedPeriodoId.set(actualId); // 👈 por defecto periodo actual

      // 2) Primera carga con periodo actual
      await this.fetchData(undefined, actualId ?? undefined, undefined);
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchData(q?: string, periodoId?: number, tipo?: TipoProyecto) {
    this.loading.set(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (typeof periodoId === 'number') params.periodo_id = periodoId;
      if (tipo) params.tipo = tipo; // 👈 si el backend lo soporta, lo usa

      const res = await firstValueFrom(
        this.api.listarProyectos(Object.keys(params).length ? params : undefined)
      );
      if (isApiOk(res)) this.items.set(res.data.data);
    } finally {
      this.loading.set(false);
    }
  }
}
