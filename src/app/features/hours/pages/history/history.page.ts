import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { HorasApiService } from '../../data-access/h.api';
import {
  HorasQuery,
  ReporteHorasOk,
  ReporteHorasResponse,
  ReporteHorasData,
  RegistroHoraItem,
  PaginacionMeta,
  VinculableProyectoRef,
} from '../../models/h.models';

import { LoaderService } from '../../../../shared/ui/loader/loader.service'; // 👈 NUEVO

type PeriodProjectAgg = {
  id: number;
  titulo: string | null;
  tipo_proyecto: string | null;
  modalidad: string | null;
  estado: string | null;
  minutos: number;
  horas: number;
  /** 👇 horas planificadas del proyecto */
  plan_horas: number | null;
};

type PeriodAgg = {
  periodo_id: number | null;
  codigo: string | null;
  minutos: number;
  horas: number;
  proyectos: PeriodProjectAgg[];
};

@Component({
  standalone: true,
  selector: 'app-history-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {
  private api = inject(HorasApiService);
  private loader = inject(LoaderService); // 👈 NUEVO

  // Estado UI
  loading = signal(true);
  loadingMore = signal(false);
  errorMsg = signal<string | null>(null);

  // Parámetros de consulta
  params = signal<HoraQuery>({
    per_page: 1000,
    page: 1,
    estado: '',
  });

  // Datos crudos
  resumen = signal<ReporteHorasData['resumen'] | null>(null);
  historial = signal<RegistroHoraItem[]>([]);
  meta = signal<PaginacionMeta | null>(null);

  // Agregado por período
  periodGroups = signal<PeriodAgg[]>([]);

  // Derivados
  totalHoras = computed(() => this.resumen()?.total_horas ?? 0);
  totalMinutos = computed(() => this.resumen()?.total_minutos ?? 0);

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resumen.set(null);       // 👈 evita mostrar totales viejos en error
    this.historial.set([]);
    this.periodGroups.set([]);
    this.meta.set(null);
    this.params.update((p) => ({ ...p, page: 1 }));

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.api.obtenerMiReporteHoras(this.params()),
          'Cargando historial de horas...'
        )
      );

      if (this.isOk(res)) {
        this.onData(res);
      } else {
        this.errorMsg.set(res.message || 'Error al cargar el reporte');
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('No se pudo cargar el historial');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    const meta = this.meta();
    if (!meta || meta.current_page >= meta.last_page) return;

    this.loadingMore.set(true);
    this.errorMsg.set(null);

    try {
      const next: HorasQuery = { ...this.params(), page: meta.current_page + 1 };
      const res = await firstValueFrom(this.api.obtenerMiReporteHoras(next));

      if (this.isOk(res)) {
        this.historial.update((arr) => arr.concat(res.data.historial || []));
        this.meta.set(res.meta);
        this.recomputeGroups();
      } else {
        this.errorMsg.set(res.message || 'Error al cargar más');
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('No se pudo cargar más resultados');
    } finally {
      this.loadingMore.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    await this.reload();
  }

  async clearFilters(): Promise<void> {
    this.params.set({ per_page: 1000, page: 1, estado: '' });
    await this.reload();
  }

  onFechaChange(kind: 'desde' | 'hasta', v: string): void {
    this.params.update((p) => ({ ...p, [kind]: v || undefined }));
  }

  onEstadoChange(v: string): void {
    this.params.update((p) => ({ ...p, estado: v }));
  }

  async verPeriodo(periodoId: number | null): Promise<void> {
    if (!periodoId) return;
    this.params.update((p) => ({ ...p, periodo_id: periodoId, page: 1 }));
    await this.reload();
  }

  verProyectoUrl(id: number) {
    return ['/vm/proyectos', id];
  }

  private onData(r: ReporteHorasOk): void {
    this.resumen.set(r.data.resumen ?? null);
    this.meta.set(r.meta ?? null);
    this.historial.set(r.data.historial || []);
    this.recomputeGroups();
  }

  private recomputeGroups(): void {
    const items = this.historial() || [];
    const groups = new Map<string, PeriodAgg>();

    for (const item of items) {
      const periodo_id = item.periodo?.id ?? null;
      const codigo = item.periodo?.codigo ?? null;

      const key = String(periodo_id ?? 'null');
      if (!groups.has(key)) {
        groups.set(key, {
          periodo_id,
          codigo,
          minutos: 0,
          horas: 0,
          proyectos: [],
        });
      }
      const g = groups.get(key)!;

      const minutos = item.minutos || 0;
      g.minutos += minutos;

      const v = item.vinculable as VinculableProyectoRef | undefined;
      if (v && v.tipo === 'vm_proyecto' && v.id != null) {
        const idx = g.proyectos.findIndex((pp) => pp.id === v.id);
        if (idx === -1) {
          g.proyectos.push({
            id: v.id,
            titulo: v.titulo ?? null,
            tipo_proyecto: v.tipo_proyecto ?? null,
            modalidad: v.modalidad ?? null,
            estado: v.estado ?? null,
            minutos,
            horas: +(minutos / 60).toFixed(2),
            plan_horas: v.horas_planificadas ?? null,
          });
        } else {
          g.proyectos[idx].minutos += minutos;
          g.proyectos[idx].horas = +(
            g.proyectos[idx].minutos / 60
          ).toFixed(2);
          // plan_horas se mantiene
        }
      }
    }

    const arr = Array.from(groups.values()).map((g) => ({
      ...g,
      horas: +(g.minutos / 60).toFixed(2),
      proyectos: g.proyectos.sort((a, b) => b.minutos - a.minutos),
    }));

    // Orden: con código primero; luego por código desc
    arr.sort((a, b) => {
      if ((a.codigo ? 1 : 0) !== (b.codigo ? 1 : 0)) {
        return (b.codigo ? 1 : 0) - (a.codigo ? 1 : 0);
      }
      const ac = a.codigo || '';
      const bc = b.codigo || '';
      return bc.localeCompare(ac);
    });

    this.periodGroups.set(arr);
  }

  private isOk(r: ReporteHorasResponse): r is ReporteHorasOk {
    return (r as ReporteHorasOk).ok === true;
  }

  // ✅ trackBy para *ngFor en el template
  trackPeriod = (_: number, p: PeriodAgg) => `${p.periodo_id ?? 'null'}`;
  trackProyecto = (_: number, pr: PeriodProjectAgg) => pr.id;

  // ------------------------------
  // Helpers para la barra progreso
  // ------------------------------
  hasPlan(pr: PeriodProjectAgg): boolean {
    return pr.plan_horas != null && pr.plan_horas > 0;
  }

  percentDone(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 100;
    const pct = (pr.horas / (pr.plan_horas as number)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  missingHours(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 0;
    return Math.max(0, (pr.plan_horas as number) - pr.horas);
  }

  hasExtra(pr: PeriodProjectAgg): boolean {
    return this.hasPlan(pr) && pr.horas > (pr.plan_horas as number);
  }

  extraHours(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 0;
    return Math.max(0, pr.horas - (pr.plan_horas as number));
  }

  /** Fondo de la barra: amarillo si faltante y EN_CURSO/PLANIFICADO; rojo si faltante y CERRADO/CANCELADO; gris si sin plan */
  barBgClass(pr: PeriodProjectAgg): string {
    if (!this.hasPlan(pr)) return 'bg-slate-100';
    const faltan = this.missingHours(pr) > 0;
    if (!faltan) return 'bg-slate-100';
    const cerrado = pr.estado === 'CERRADO' || pr.estado === 'CANCELADO';
    return cerrado ? 'bg-red-100' : 'bg-yellow-100';
  }
}

// Tipado local para el signal de params
type HoraQuery = HorasQuery;
