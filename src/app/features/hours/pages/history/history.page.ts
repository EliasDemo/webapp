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
  VinculableRef,
  ResumenPorVinculoItem,
} from '../../models/h.models';

import { LoaderService } from '../../../../shared/ui/loader/loader.service';

type PeriodProjectAgg = {
  id: number;
  /** vm_proyecto | vm_evento | otro alias */
  tipo: string;
  /** PROYECTO | EVENTO | alias en mayúsculas */
  tipo_label: string;

  codigo: string | null;
  titulo: string | null;
  tipo_proyecto: string | null;
  modalidad: string | null;
  estado: string | null;

  /** minutos/horas en ESTE período */
  minutos: number;
  horas: number;

  /** totales globales (todos los períodos) sacados de resumen.por_vinculo */
  total_minutos: number | null;
  total_horas: number | null;

  /** meta de horas por participante */
  meta_horas: number | null;
  meta_minutos: number | null;
  cumplido: boolean | null;

  /** registros individuales de este vínculo dentro del período */
  registros: RegistroHoraItem[];
};

type PeriodAgg = {
  periodo_id: number | null;
  codigo: string | null;
  minutos: number;
  horas: number;
  /** vínculos del período (proyectos + eventos) */
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
  private loader = inject(LoaderService);

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
    this.resumen.set(null);
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

  /**
   * Re-agrupa el historial por período y por vínculo (proyecto/evento),
   * enriqueciendo cada vínculo con:
   *  - totales globales (resumen.por_vinculo)
   *  - meta de horas
   *  - flag cumplido
   *  - lista de registros individuales en ese período
   */
  private recomputeGroups(): void {
    const items = this.historial() || [];
    const resumenPorVinculo: ResumenPorVinculoItem[] =
      this.resumen()?.por_vinculo ?? [];

    // Mapa rápido tipo+id → resumen
    const resumenMap = new Map<string, ResumenPorVinculoItem>();
    for (const r of resumenPorVinculo) {
      const key = `${r.tipo}|${r.id}`;
      resumenMap.set(key, r);
    }

    const groups = new Map<string, PeriodAgg>();

    for (const item of items) {
      const periodo_id = item.periodo?.id ?? null;
      const codigoPeriodo = item.periodo?.codigo ?? null;

      const keyPeriodo = String(periodo_id ?? 'null');
      if (!groups.has(keyPeriodo)) {
        groups.set(keyPeriodo, {
          periodo_id,
          codigo: codigoPeriodo,
          minutos: 0,
          horas: 0,
          proyectos: [],
        });
      }
      const g = groups.get(keyPeriodo)!;

      const minutos = item.minutos || 0;
      g.minutos += minutos;

      const v = item.vinculable as VinculableRef | undefined | null;
      if (!v || v.id == null) continue;

      const tipo = v.tipo || 'desconocido';
      const vincKey = `${tipo}|${v.id}`;
      const rResumen = resumenMap.get(vincKey) || null;

      const tipo_label =
        rResumen?.tipo_label ??
        (tipo === 'vm_proyecto'
          ? 'PROYECTO'
          : tipo === 'vm_evento'
          ? 'EVENTO'
          : (tipo || '').toUpperCase());

      const meta_horas = rResumen?.horas_requeridas ?? null;
      const meta_minutos =
        rResumen?.minutos_requeridos ??
        (meta_horas != null ? meta_horas * 60 : null);
      const total_minutos = rResumen?.minutos ?? null;
      const total_horas =
        rResumen?.horas ??
        (total_minutos != null ? +(total_minutos / 60).toFixed(2) : null);

      const existingIndex = g.proyectos.findIndex(
        (pp) => pp.id === v.id && pp.tipo === tipo
      );

      if (existingIndex === -1) {
        const horas = +(minutos / 60).toFixed(2);
        g.proyectos.push({
          id: v.id as number,
          tipo,
          tipo_label,
          codigo: v.codigo ?? null,
          titulo: v.titulo ?? v.codigo ?? null,
          tipo_proyecto: (v as any).tipo_proyecto ?? null,
          modalidad: (v as any).modalidad ?? null,
          estado: v.estado ?? null,
          minutos,
          horas,
          total_minutos,
          total_horas,
          meta_horas,
          meta_minutos,
          cumplido: rResumen?.cumplido ?? null,
          registros: [item],
        });
      } else {
        const agg = g.proyectos[existingIndex];
        agg.minutos += minutos;
        agg.horas = +(agg.minutos / 60).toFixed(2);
        agg.registros.push(item);
      }
    }

    const arr = Array.from(groups.values()).map((g) => ({
      ...g,
      horas: +(g.minutos / 60).toFixed(2),
      proyectos: g.proyectos.sort((a, b) => b.minutos - a.minutos),
    }));

    // Orden: primero con código, luego por código desc
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

  // trackBy
  trackPeriod = (_: number, p: PeriodAgg) => `${p.periodo_id ?? 'null'}`;
  trackProyecto = (_: number, pr: PeriodProjectAgg) => `${pr.tipo}|${pr.id}`;

  // ------------------------------
  // Helpers barra de progreso / metas
  // ------------------------------
  hasPlan(pr: PeriodProjectAgg): boolean {
    return pr.meta_horas != null && pr.meta_horas > 0;
  }

  /** % de avance respecto a la meta (usa total_horas si está, si no, las horas del período) */
  percentDone(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 100;
    const meta = pr.meta_horas as number;
    const done = pr.total_horas ?? pr.horas;
    const pct = (done / meta) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  /** Horas faltantes para la meta (global) */
  missingHours(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 0;
    const meta = pr.meta_horas as number;
    const done = pr.total_horas ?? pr.horas;
    return Math.max(0, meta - done);
  }

  /** true si ya pasó la meta global */
  hasExtra(pr: PeriodProjectAgg): boolean {
    return this.hasPlan(pr) && (pr.total_horas ?? pr.horas) > (pr.meta_horas as number);
  }

  extraHours(pr: PeriodProjectAgg): number {
    if (!this.hasPlan(pr)) return 0;
    const meta = pr.meta_horas as number;
    const done = pr.total_horas ?? pr.horas;
    return Math.max(0, done - meta);
  }

  /** Fondo de la barra según estado de meta y estado del vínculo */
  barBgClass(pr: PeriodProjectAgg): string {
    if (!this.hasPlan(pr)) return 'bg-slate-100';
    const faltan = this.missingHours(pr) > 0;
    if (!faltan) return 'bg-slate-100';
    const cerrado = pr.estado === 'CERRADO' || pr.estado === 'CANCELADO';
    return cerrado ? 'bg-red-100' : 'bg-yellow-100';
  }
}

// alias local para el signal de params
type HoraQuery = HorasQuery;
