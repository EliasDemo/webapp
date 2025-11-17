import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RpApiService } from '../../data-access/rp.api.service';
import { LookupsApiService } from '../../../vm/lookups/lookups.api';

import {
  RpAvanceFiltro,
  RpAvancePorProyectoData,
  RpAvanceProyectoItem,
} from '../../models/rp.models';

type PeriodoVM = { id: number; anio: number; ciclo: string; estado?: string };

@Component({
  standalone: true,
  selector: 'rp-avance-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './rp-avance.page.html',
})
export class RpAvancePage {
  // APIs
  private rpApi = inject(RpApiService);
  private lookups = inject(LookupsApiService);

  // Estado base
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);

  // Filtros
  estado = signal<'APROBADO' | 'PENDIENTE' | 'RECHAZADO' | 'ANULADO' | '*'>('APROBADO');
  periodoId = signal<number | null>(null);

  // Periodos disponibles (para el select)
  periodos = signal<PeriodoVM[]>([]);

  // Datos
  data = signal<RpAvancePorProyectoData | null>(null);

  // Derivados
  proyectos = computed<RpAvanceProyectoItem[]>(() => this.data()?.por_proyecto ?? []);
  totalHoras = computed<number>(() => this.data()?.total_horas ?? 0);
  totalMinutos = computed<number>(() => this.data()?.total_minutos ?? 0);

  constructor() {
    this.loadPeriodos();
    this.consultar();
  }

  // ───────── Periodos (lookup) ─────────
  private loadPeriodos(): void {
    this.lookups.fetchPeriodos('', false, 100).subscribe({
      next: (arr: PeriodoVM[]) => this.periodos.set(arr),
      error: () => this.periodos.set([]),
    });
  }

  // ───────── Acciones ─────────
  consultar(): void {
    this.error.set(null);
    this.loading.set(true);

    const filtro: RpAvanceFiltro = {
      estado: this.estado(),
      periodo_id: this.periodoId() ?? undefined,
    };

    this.rpApi.obtenerMiAvancePorProyecto(filtro).subscribe({
      next: (resp) => {
        this.data.set(resp.data);
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo obtener el avance.';
        this.error.set(msg);
      },
      complete: () => this.loading.set(false),
    });
  }

  limpiar(): void {
    this.estado.set('APROBADO');
    this.periodoId.set(null);
    this.data.set(null);
    this.error.set(null);
    this.consultar();
  }

  porcentajeLabel(p: RpAvanceProyectoItem): string {
    if (p.porcentaje == null) return '—';
    return `${p.porcentaje}%`;
  }

  // Helpers template
  trackPeriodo = (_: number, p: PeriodoVM) => p.id;
  trackProyecto = (_: number, p: RpAvanceProyectoItem) => p.id;
}
