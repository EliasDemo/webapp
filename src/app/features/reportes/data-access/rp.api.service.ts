import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  ApiResponse,
  RpHorasFiltro,
  RpHorasPorPeriodoPayload,
  RpHorasPorPeriodoItem
} from '../models/rp.models';

@Injectable({ providedIn: 'root' })
export class RpApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string
  ) {
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  // Helpers URL
  private autoHorasUrl(): string { return `${this.baseUrl}/reportes/horas`; }
  private paramHorasUrl(epSedeId: number): string {
    return `${this.baseUrl}/ep-sedes/${epSedeId}/reportes/horas`;
  }

  // ──────────────────────────────────────────────
  // ⏱️ HORAS POR PERÍODO
  // ──────────────────────────────────────────────

  /** AUTO: sin epSedeId en path. */
  listarHorasPorPeriodoAuto(
    filtro?: RpHorasFiltro
  ): Observable<ApiResponse<RpHorasPorPeriodoItem[]>> {
    const params = this.toParams(filtro);
    return this.http
      .get<RpHorasPorPeriodoPayload>(this.autoHorasUrl(), { params })
      .pipe(map(payload => ({ ok: true, data: payload?.data ?? [], meta: payload?.meta })));
  }

  /** PARAM: con epSedeId explícito. */
  listarHorasPorPeriodo(
    epSedeId: number,
    filtro?: RpHorasFiltro
  ): Observable<ApiResponse<RpHorasPorPeriodoItem[]>> {
    const params = this.toParams(filtro);
    return this.http
      .get<RpHorasPorPeriodoPayload>(this.paramHorasUrl(epSedeId), { params })
      .pipe(map(payload => ({ ok: true, data: payload?.data ?? [], meta: payload?.meta })));
  }

  /** AUTO: Excel */
  exportarHorasPorPeriodoAuto(
    filtro?: RpHorasFiltro
  ): Observable<Blob> {
    const params = this.toParams(filtro);
    return this.http.get(`${this.autoHorasUrl()}/export`, {
      params,
      responseType: 'blob' as const,
    });
  }

  /** PARAM: Excel */
  exportarHorasPorPeriodo(
    epSedeId: number,
    filtro?: RpHorasFiltro
  ): Observable<Blob> {
    const params = this.toParams(filtro);
    return this.http.get(`${this.paramHorasUrl(epSedeId)}/export`, {
      params,
      responseType: 'blob' as const,
    });
  }

  /** 📥 Plantilla para importar horas históricas */
  descargarPlantillaHorasHistoricas(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/vm/import/historico-horas/template`, {
      responseType: 'blob' as const,
    });
  }

  // ──────────────────────────────────────────────
  // Utils
  // ──────────────────────────────────────────────
  private toParams(f?: RpHorasFiltro): HttpParams {
    let params = new HttpParams();
    if (!f) return params;

    if (Array.isArray(f.periodos) && f.periodos.length) {
      f.periodos.forEach((p) => {
        if (p !== undefined && p !== null && p !== '') {
          params = params.append('periodos[]', String(p));
        }
      });
    }

    if (f.ultimos != null) params = params.set('ultimos', String(f.ultimos));

    if (f.unidad) params = params.set('unidad', f.unidad);
    if (f.estado) params = params.set('estado', f.estado);
    if (f.orden)  params = params.set('orden', f.orden);
    if (f.dir)    params = params.set('dir', f.dir);

    if (f.solo_con_horas_periodos !== undefined) {
      const v = typeof f.solo_con_horas_periodos === 'boolean'
        ? (f.solo_con_horas_periodos ? '1' : '0')
        : (f.solo_con_horas_periodos === '1' ? '1' : '0');
      params = params.set('solo_con_horas_periodos', v);
    }

    return params;
  }
}
