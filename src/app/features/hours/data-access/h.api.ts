// h.api.ts

import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  HorasQuery,
  ReporteHorasResponse,
} from '../models/h.models';

@Injectable({ providedIn: 'root' })
export class HorasApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  /**
   * GET /api/reportes/horas/mias
   * Resumen + historial del usuario autenticado.
   */
  obtenerMiReporteHoras(params?: HorasQuery): Observable<ReporteHorasResponse> {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      });
    }
    return this.http.get<ReporteHorasResponse>(`${this.base}/reportes/horas/mias`, { params: p });
  }

  /**
   * GET /api/reportes/horas/expedientes/{expediente}
   * Resumen + historial de un expediente (requiere permisos).
   */
  obtenerReporteHorasDeExpediente(expedienteId: number, params?: HorasQuery): Observable<ReporteHorasResponse> {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      });
    }
    return this.http.get<ReporteHorasResponse>(`${this.base}/reportes/horas/expedientes/${expedienteId}`, { params: p });
  }
}
