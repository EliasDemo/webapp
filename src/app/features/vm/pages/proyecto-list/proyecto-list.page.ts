import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { VmApiService } from '../../data-access/vm.api';
import { VmProyecto, isApiOk, TipoProyecto } from '../../models/proyecto.models';
import { ProyectoCardComponent } from '../../components/proyecto-card/proyecto-card.component';

// Lookups
import { LookupsApiService } from '../../lookups/lookups.api';

type PeriodoOpt = { id: number; anio: number; ciclo: string; estado?: string };
type TipoFiltro = 'ALL' | TipoProyecto;
type PeriodoSel = number | 'ALL' | 'CURRENT' | null;

@Component({
  standalone: true,
  selector: 'app-proyecto-list-page',
  imports: [CommonModule, RouterLink, FormsModule, ProyectoCardComponent],
  templateUrl: './proyecto-list.page.html'
})
export class ProyectoListPage {
  private api = inject(VmApiService);
  private lookups = inject(LookupsApiService);

  // Estado
  loading = signal(true);
  items = signal<VmProyecto[]>([]);
  q = signal('');

  // Lookup de periodos
  periodos = signal<PeriodoOpt[]>([]);
  defaultPeriodoId = signal<number | null>(null); // id del EN_CURSO (o fallback)
  selectedPeriodoId = signal<PeriodoSel>(null);   // 'CURRENT' | 'ALL' | id | null

  // Filtro tipo
  tipo = signal<TipoFiltro>('ALL');

  constructor() {
    this.loadPeriodosYPrimeraCarga();
  }

  // ===== Helpers de periodos (agrupación, orden, normalización) =====

  /** Periodo (objeto) por id */
  private findPeriodoById = (id?: number | null) =>
    (id ? this.periodos().find(p => p.id === id) ?? null : null);

  /** Periodo actual (objeto) */
  defaultPeriodo = computed(() => this.findPeriodoById(this.defaultPeriodoId()));

  /** Periodos ordenados desc: año (desc), ciclo (2,1) */
  orderedPeriodos = computed(() => {
    return [...this.periodos()].sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      const ca = Number(a.ciclo), cb = Number(b.ciclo);
      return cb - ca; // 2 primero
    });
  });

  /** Agrupa por año para el <optgroup> */
  periodoGroups = computed(() => {
    const groups: Array<{ anio: number; items: PeriodoOpt[] }> = [];
    const byYear = new Map<number, PeriodoOpt[]>();
    for (const p of this.orderedPeriodos()) {
      const list = byYear.get(p.anio) ?? [];
      list.push(p);
      byYear.set(p.anio, list);
    }
    for (const [anio, items] of byYear.entries()) {
      groups.push({ anio, items });
    }
    // ordenar grupos por año desc
    groups.sort((a, b) => b.anio - a.anio);
    return groups;
  });

  /** Id numérico normalizado a partir de la selección (CURRENT→default, ALL→undefined) */
  private normalizedPeriodoId(): number | undefined {
    const sel = this.selectedPeriodoId();
    if (sel === 'ALL' || sel === null) return undefined;
    if (sel === 'CURRENT') return this.defaultPeriodoId() ?? undefined;
    return Number(sel) || undefined;
  }

  isAllSelected(): boolean {
    return this.selectedPeriodoId() === 'ALL';
  }

  // ===== Lista filtrada (cliente) =====
  filtered = computed(() => {
    let r = this.items();

    const selId = this.normalizedPeriodoId();
    if (typeof selId === 'number') {
      r = r.filter(p => p.periodo_id === selId);
    }

    const t = this.tipo();
    if (t !== 'ALL') {
      r = r.filter(p => p.tipo === t);
    }

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
    const normSel = this.normalizedPeriodoId();
    const defaultId = this.defaultPeriodoId() ?? undefined;
    const isPeriodoDirty =
      (normSel !== undefined && normSel !== defaultId) ||
      (normSel === undefined && defaultId !== undefined && this.selectedPeriodoId() !== 'CURRENT');

    return !!this.q() || (this.tipo() !== 'ALL') || isPeriodoDirty;
  });

  // ===== Acciones UI =====
  async handleSearch() {
    const periodoId = this.normalizedPeriodoId();
    await this.fetchData(this.q(), periodoId, this.tipo());
  }

  async handleClear() {
    this.q.set('');
    this.tipo.set('ALL');
    this.selectedPeriodoId.set('CURRENT'); // vuelve a "Periodo actual"
    await this.fetchData(undefined, this.defaultPeriodoId() ?? undefined, undefined);
  }

  onPeriodoChange(v: any) {
    if (v === 'ALL') {
      this.selectedPeriodoId.set('ALL');
    } else if (v === 'CURRENT') {
      this.selectedPeriodoId.set('CURRENT');
    } else {
      this.selectedPeriodoId.set(Number(v) || null);
    }
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

  // Navegar al periodo anterior / siguiente según el orden
  async stepPeriodo(dir: -1 | 1) {
    const list = this.orderedPeriodos();
    const currentId = this.normalizedPeriodoId() ?? this.defaultPeriodoId() ?? null;
    if (!currentId) return;

    const idx = list.findIndex(p => p.id === currentId);
    if (idx < 0) return;

    const next = list[idx + dir];
    if (!next) return;

    this.selectedPeriodoId.set(next.id);
    await this.fetchData(this.q(), next.id, this.tipo());
  }

  // ===== Data =====
  private async loadPeriodosYPrimeraCarga() {
    try {
      // 👉 Trae **todos** los periodos (no solo activos)
      const periodos = await firstValueFrom(this.lookups.fetchPeriodos('', false, 500));
      // Ordenamos igual que la vista
      periodos.sort((a, b) => (b.anio - a.anio) || (Number(b.ciclo) - Number(a.ciclo)));
      this.periodos.set(periodos);

      // Detecta "actual": EN_CURSO; si no hay, usa PLANIFICADO; si no, el más reciente
      const actual =
        periodos.find(p => p.estado === 'EN_CURSO')
        ?? periodos.find(p => p.estado === 'PLANIFICADO')
        ?? periodos[0];

      const actualId = actual?.id ?? null;
      this.defaultPeriodoId.set(actualId);

      // Selección visual por defecto: "Periodo actual"
      this.selectedPeriodoId.set('CURRENT');

      // 1ª carga usando el id numérico del actual (si existe)
      await this.fetchData(undefined, actualId ?? undefined, undefined);
    } finally {
      this.loading.set(false);
    }
  }

  // 🔧 FIX: aceptar TipoFiltro y filtrar internamente 'ALL'
  private async fetchData(q?: string, periodoId?: number, tipo?: TipoFiltro) {
    this.loading.set(true);
    try {
      const params: any = {};
      if (q) params.q = q;
      if (typeof periodoId === 'number') params.periodo_id = periodoId;

      // Type guard para sólo enviar 'LIBRE' | 'VINCULADO'
      const isTipoProyecto = (t: any): t is TipoProyecto =>
        t === 'LIBRE' || t === 'VINCULADO';
      if (tipo && isTipoProyecto(tipo)) {
        params.tipo = tipo;
      }

      const res = await firstValueFrom(
        this.api.listarProyectos(Object.keys(params).length ? params : undefined)
      );
      if (isApiOk(res)) this.items.set(res.data.data);
    } finally {
      this.loading.set(false);
    }
  }
}
