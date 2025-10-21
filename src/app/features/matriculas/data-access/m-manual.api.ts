import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  ManualBuscarResponse,
  RegistrarPayload, RegistrarResponse,
  MatricularPayload, MatricularResponse,
  CambiarEstadoResponse
} from '../models/m-manual.models';

@Injectable({ providedIn: 'root' })
export class MatriculaManualApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  buscar(params: { codigo?: string; documento?: string; email?: string }): Observable<ManualBuscarResponse> {
    let p = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        p = p.set(k, String(v).trim());
      }
    });
    return this.http.get<ManualBuscarResponse>(`${this.base}/matriculas/manual/alumnos/buscar`, { params: p });
    // backend: GET /api/matriculas/manual/alumnos/buscar
  }

  registrarOActualizar(payload: RegistrarPayload): Observable<RegistrarResponse> {
    return this.http.post<RegistrarResponse>(`${this.base}/matriculas/manual/registrar`, payload);
  }

  matricular(payload: MatricularPayload): Observable<MatricularResponse> {
    return this.http.post<MatricularResponse>(`${this.base}/matriculas/manual/matricular`, payload);
  }

  cambiarEstadoExpediente(expedienteId: number, estado: 'ACTIVO'|'SUSPENDIDO'|'EGRESADO'|'CESADO'): Observable<CambiarEstadoResponse> {
    return this.http.patch<CambiarEstadoResponse>(`${this.base}/matriculas/manual/expedientes/${expedienteId}/estado`, { estado });
  }
}
