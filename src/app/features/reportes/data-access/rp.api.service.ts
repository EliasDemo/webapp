import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';

import {
  ApiResponse,
  RpHorasFiltro,
  RpHorasPorPeriodoPayload,
  RpHorasPorPeriodoItem,
  RpAvanceFiltro,
  RpAvancePorProyectoData,
  VmImportHorasHistoricasOptions,
  VmImportHorasHistoricasResponse,
  VmImportHorasHistoricasStatus,
  VmPlantillaHorasOptions,
} from '../models/rp.models';

@Injectable({ providedIn: 'root' })
export class RpApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string,
  ) {
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  // Helpers URL
  private autoHorasUrl(): string {
    return `${this.baseUrl}/reportes/horas`;
  }

  private paramHorasUrl(epSedeId: number): string {
    return `${this.baseUrl}/ep-sedes/${epSedeId}/reportes/horas`;
  }

  // ──────────────────────────────────────────────
  // ⏱️ HORAS POR PERÍODO
  // ──────────────────────────────────────────────

  /** AUTO: sin epSedeId en path. */
  listarHorasPorPeriodoAuto(
    filtro?: RpHorasFiltro,
  ): Observable<ApiResponse<RpHorasPorPeriodoItem[]>> {
    const params = this.toHorasParams(filtro);
    return this.http
      .get<RpHorasPorPeriodoPayload>(this.autoHorasUrl(), { params })
      .pipe(
        map((payload) => ({
          ok: true,
          data: payload?.data ?? [],
          meta: payload?.meta,
        })),
      );
  }

  /** PARAM: con epSedeId explícito. */
  listarHorasPorPeriodo(
    epSedeId: number,
    filtro?: RpHorasFiltro,
  ): Observable<ApiResponse<RpHorasPorPeriodoItem[]>> {
    const params = this.toHorasParams(filtro);
    return this.http
      .get<RpHorasPorPeriodoPayload>(this.paramHorasUrl(epSedeId), { params })
      .pipe(
        map((payload) => ({
          ok: true,
          data: payload?.data ?? [],
          meta: payload?.meta,
        })),
      );
  }

  /** AUTO: Excel */
  exportarHorasPorPeriodoAuto(filtro?: RpHorasFiltro): Observable<Blob> {
    const params = this.toHorasParams(filtro);
    return this.http.get(`${this.autoHorasUrl()}/export`, {
      params,
      responseType: 'blob' as const,
    });
  }

  /** PARAM: Excel */
  exportarHorasPorPeriodo(
    epSedeId: number,
    filtro?: RpHorasFiltro,
  ): Observable<Blob> {
    const params = this.toHorasParams(filtro);
    return this.http.get(`${this.paramHorasUrl(epSedeId)}/export`, {
      params,
      responseType: 'blob' as const,
    });
  }

  // ──────────────────────────────────────────────
  // 📊 REPORTE: MI AVANCE POR PROYECTO
  //   GET /api/reportes/horas/mias/por-proyecto
  // ──────────────────────────────────────────────

  obtenerMiAvancePorProyecto(
    filtro?: RpAvanceFiltro,
  ): Observable<ApiResponse<RpAvancePorProyectoData>> {
    const params = this.toAvanceParams(filtro);
    const url = `${this.baseUrl}/reportes/horas/mias/por-proyecto`;

    return this.http.get<any>(url, { params }).pipe(
      map((res) => {
        // Backend devuelve { ok, data } – o algo muy parecido.
        const ok = res?.ok ?? true;
        const data = (res?.data ?? res) as RpAvancePorProyectoData;
        return { ok, data };
      }),
    );
  }

  // (Opcional) si quieres envolver también:
  // GET /api/reportes/horas/mias
  obtenerMisHorasRaw(): Observable<any> {
    const url = `${this.baseUrl}/reportes/horas/mias`;
    return this.http.get<any>(url);
  }

  // GET /api/reportes/horas/expedientes/{expediente}
  obtenerReporteHorasPorExpediente(expedienteId: number): Observable<any> {
    const url = `${this.baseUrl}/reportes/horas/expedientes/${expedienteId}`;
    return this.http.get<any>(url);
  }

  // ──────────────────────────────────────────────
  // 📥 IMPORT HORAS HISTÓRICAS (VM)
  // ──────────────────────────────────────────────

  /** 📄 Descargar plantilla (opcionalmente filtrando periodos / últimos N). */
  descargarPlantillaHorasHistoricas(
    opts?: VmPlantillaHorasOptions,
  ): Observable<Blob> {
    let params = new HttpParams();

    if (opts?.periodos?.length) {
      opts.periodos.forEach((p) => {
        if (p) params = params.append('periodos[]', String(p));
      });
    }

    if (opts?.ultimos != null) {
      params = params.set('ultimos', String(opts.ultimos));
    }

    return this.http.get(
      `${this.baseUrl}/vm/import/historico-horas/plantilla`,
      {
        params,
        responseType: 'blob' as const,
      },
    );
  }

  /**
   * Subir archivo de horas históricas.
   * POST /api/vm/import/historico-horas
   */
  importarHorasHistoricas(
    file: File,
    options?: VmImportHorasHistoricasOptions,
  ): Observable<VmImportHorasHistoricasResponse> {
    const url = `${this.baseUrl}/vm/import/historico-horas`;
    const form = new FormData();

    form.append('file', file);

    if (options?.ep_sede_id != null) {
      form.append('ep_sede_id', String(options.ep_sede_id));
    }

    if (options?.replace != null) {
      form.append('replace', options.replace ? '1' : '0');
    }

    return this.http.post<VmImportHorasHistoricasResponse>(url, form);
  }

  /**
   * Estado simple: ¿existen horas para esa EP-SEDE / períodos?
   * GET /api/vm/import/historico-horas/status
   */
  consultarEstadoHorasHistoricas(
    epSedeId?: number,
    periodos?: string[],
  ): Observable<VmImportHorasHistoricasStatus> {
    const url = `${this.baseUrl}/vm/import/historico-horas/status`;
    let params = new HttpParams();

    if (epSedeId != null) {
      params = params.set('ep_sede_id', String(epSedeId));
    }

    if (Array.isArray(periodos) && periodos.length) {
      periodos.forEach((p) => {
        if (p) params = params.append('periodos[]', String(p));
      });
    }

    return this.http.get<VmImportHorasHistoricasStatus>(url, { params });
  }

  // ──────────────────────────────────────────────
  // Utils
  // ──────────────────────────────────────────────

  /** Params para horas por período. */
  private toHorasParams(f?: RpHorasFiltro): HttpParams {
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
    if (f.orden) params = params.set('orden', f.orden);
    if (f.dir) params = params.set('dir', f.dir);

    if (f.solo_con_horas_periodos !== undefined) {
      const v =
        typeof f.solo_con_horas_periodos === 'boolean'
          ? f.solo_con_horas_periodos
            ? '1'
            : '0'
          : f.solo_con_horas_periodos === '1'
          ? '1'
          : '0';

      params = params.set('solo_con_horas_periodos', v);
    }

    return params;
  }

  /** Params para miAvancePorProyecto. */
  private toAvanceParams(f?: RpAvanceFiltro): HttpParams {
    let params = new HttpParams();
    if (!f) return params;

    if (f.estado) {
      params = params.set('estado', f.estado);
    }

    if (f.periodo_id != null) {
      params = params.set('periodo_id', String(f.periodo_id));
    }

    if (f.debug != null) {
      params = params.set('debug', f.debug ? '1' : '0');
    }

    return params;
  }
}
