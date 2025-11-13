import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  AvancePorProyectoResponse,
  AvanceProyectoQuery,
  HorasQuery,
  ReporteHorasResponse,
} from '../models/h.models';

@Injectable({ providedIn: 'root' })
export class HorasApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  /** Helper: construye HttpParams seguro (arrays/boolean/0 válidos) */
  private toParams(params?: Record<string, any>): HttpParams {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v)) {
        v.forEach(it => { if (it !== undefined && it !== null && it !== '') p = p.append(k, String(it)); });
      } else {
        p = p.set(k, String(v));
      }
    });
    return p;
  }

  /** Helper: convierte error de red a forma tipada { ok:false } */
  private toFail(e: any, fallbackMsg = 'No se pudo obtener el reporte de horas'): ReporteHorasResponse {
    const message =
      e?.error?.message ||
      e?.message ||
      fallbackMsg;
    const meta: any = { status: e?.status ?? -1 };
    return { ok: false, message, meta };
  }

  /**
   * GET /api/reportes/horas/mias
   * Resumen + historial del usuario autenticado.
   */
  obtenerMiReporteHoras(params?: HorasQuery): Observable<ReporteHorasResponse> {
    const p = this.toParams(params);
    return this.http
      .get<ReporteHorasResponse>(`${this.base}/reportes/horas/mias`, { params: p })
      .pipe(
        catchError(err => of(this.toFail(err)))
      );
  }

  /**
   * GET /api/reportes/horas/expedientes/{expediente}
   * Resumen + historial de un expediente (requiere permisos).
   */
  obtenerReporteHorasDeExpediente(expedienteId: number, params?: HorasQuery): Observable<ReporteHorasResponse> {
    const p = this.toParams(params);
    return this.http
      .get<ReporteHorasResponse>(`${this.base}/reportes/horas/expedientes/${expedienteId}`, { params: p })
      .pipe(
        catchError(err => of(this.toFail(err, 'No se pudo obtener el reporte del expediente')))
      );
  }

    /**
   * GET /api/reportes/horas/mias/por-proyecto
   * Suma minutos por proyecto (vm_proyecto directo + vm_proceso→proyecto).
   */
  obtenerMiAvancePorProyecto(params?: AvanceProyectoQuery): Observable<AvancePorProyectoResponse> {
    const p = this.toParams(params);
    return this.http
      .get<AvancePorProyectoResponse>(`${this.base}/reportes/horas/mias/por-proyecto`, { params: p })
      .pipe(
        catchError(err => of({
          ok: false,
          message: err?.error?.message || err?.message || 'No se pudo obtener el avance por proyecto',
          meta: { status: err?.status ?? -1 }
        } as AvancePorProyectoResponse))
      );
    }
}
