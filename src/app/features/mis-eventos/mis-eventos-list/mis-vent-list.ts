import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EvApiService } from '../../events/data-access/ev-api.service';
import {
  VmMisEventosPeriodo,
  VmEventoAlumnoItem,
  VmMisEventosData,
} from '../../events/models/ev.models';

@Component({
  standalone: true,
  selector: 'app-mis-vent-list-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-vent-list.html',
  styleUrls: [],
})
export class MisVentListPage {
  private api = inject(EvApiService);

  loading = signal(true);
  error   = signal<string | null>(null);

  periodos = signal<VmMisEventosPeriodo[]>([]);
  eventos  = signal<VmEventoAlumnoItem[]>([]);

  showHelp = signal(false);

  // Período actual = EN_CURSO, si no existe, el primero de la lista
  currentPeriodo = computed(() => {
    const ps = this.periodos();
    if (!ps.length) return null;
    const enCurso = ps.find(p => (p.estado || '').toUpperCase() === 'EN_CURSO');
    return enCurso ?? ps[0];
  });

  eventosPeriodoActual = computed(() => {
    const p = this.currentPeriodo();
    if (!p) return [];
    return this.eventos().filter(e => e.periodo_id === p.id);
  });

  historicoPeriodos = computed(() => {
    const actual = this.currentPeriodo();
    const ps = this.periodos();
    if (!ps.length || !actual) return [];
    return ps.filter(p => p.id !== actual.id);
  });

  totalEventos = computed(() => this.eventos().length);

  constructor() {
    this.cargarMisEventos();
  }

  async cargarMisEventos() {
    this.loading.set(true);
    this.error.set(null);
    try {
      // Pedimos TODO el historial, luego filtramos en el front
      const res = await firstValueFrom(
        this.api.listarMisEventos({ estado_participacion: 'TODOS' })
      );
      if (!res || res.ok === false) {
        this.error.set((res as any)?.message || 'No se pudieron cargar tus eventos.');
        return;
      }

      const data: VmMisEventosData = res.data || { periodos: [], eventos: [] };
      this.periodos.set(data.periodos ?? []);
      this.eventos.set(data.eventos ?? []);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudieron cargar tus eventos.');
    } finally {
      this.loading.set(false);
    }
  }

  toggleHelp() {
    this.showHelp.update(v => !v);
  }

  eventosPorPeriodo(id: number): VmEventoAlumnoItem[] {
    return this.eventos().filter(e => e.periodo_id === id);
  }

  tieneHistorial(): boolean {
    return this.historicoPeriodos().length > 0;
  }

  // Acepta Periodo, VmMisEventosPeriodo o VmEventoAlumnoItem['periodo']
  periodoEtiqueta(
    p: { anio: number; ciclo: string | number } | null | undefined
  ): string {
    if (!p) return '—';
    return `${p.anio} - ${p.ciclo}`;
  }

  estadoEventoClass(estado: string | null | undefined): string {
    const s = String(estado ?? '').toUpperCase();
    const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border';
    if (s === 'PLANIFICADO') return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    if (s === 'EN_CURSO')    return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    if (s === 'CERRADO')     return `${base} bg-slate-100 text-slate-700 border-slate-200`;
    if (s === 'CANCELADO')   return `${base} bg-rose-50 text-rose-700 border-rose-200`;
    return `${base} bg-slate-100 text-slate-700 border-slate-200`;
  }

  estadoParticipacionClass(estado: string | null | undefined): string {
    const s = String(estado ?? '').toUpperCase();
    const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border';
    if (s === 'INSCRITO')    return `${base} bg-sky-50 text-sky-700 border-sky-200`;
    if (s === 'CONFIRMADO')  return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    if (s === 'FINALIZADO')  return `${base} bg-slate-100 text-slate-700 border-slate-200`;
    if (s === 'RETIRADO')    return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    if (s === 'CANCELADO')   return `${base} bg-rose-50 text-rose-700 border-rose-200`;
    return `${base} bg-slate-100 text-slate-700 border-slate-200`;
  }
}
