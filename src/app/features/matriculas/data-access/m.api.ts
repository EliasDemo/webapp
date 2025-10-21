// src/app/features/matriculas/data-access/m.api.ts
import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  MatriculaImportPayload,
  MatriculaImportResponse,
} from '../models/m.models';

@Injectable({ providedIn: 'root' })
export class MatriculaApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  /**
   * POST /api/matriculas/import (multipart/form-data)
   * Importa Excel y ejecuta la lógica de registro/actualización.
   */
  importarMatriculas(payload: MatriculaImportPayload): Observable<MatriculaImportResponse> {
    const fd = new FormData();
    fd.append('file', payload.file);
    fd.append('periodo_id', String(payload.periodo_id));
    if (payload.ep_sede_id !== undefined && payload.ep_sede_id !== null) {
      fd.append('ep_sede_id', String(payload.ep_sede_id));
    }
    return this.http.post<MatriculaImportResponse>(`${this.base}/matriculas/import`, fd);
  }

  /**
   * GET /api/matriculas/plantilla
   * Descarga la plantilla Excel.
   */
  descargarPlantilla(): Observable<Blob> {
    return this.http.get(`${this.base}/matriculas/plantilla`, { responseType: 'blob' });
  }
}
