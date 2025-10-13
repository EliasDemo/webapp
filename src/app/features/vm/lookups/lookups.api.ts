// src/app/features/vm/lookups/lookups.api.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

type EpSedeRaw = { id: number; label?: string; nombre?: string };
type PeriodoRaw = {
  id: number;
  anio: number;
  ciclo: string | number;
  estado?: 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | string;
  fecha_inicio?: string;
  fecha_fin?: string;
};

// Normaliza respuestas: [], {items:[]}, {data:{items:[]}}, {data:[]}
function pickItems<T = any>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (Array.isArray(resp?.items)) return resp.items as T[];
  if (Array.isArray(resp?.data)) return resp.data as T[];
  if (Array.isArray(resp?.data?.items)) return resp.data.items as T[];
  return [];
}

@Injectable({ providedIn: 'root' })
export class LookupsApiService {
  private http = inject(HttpClient);
  private base = '/api/lookups';

  /**
   * EP-SEDE visibles para el usuario (como staff).
   * GET /api/lookups/ep-sedes?solo_mias=1&solo_activas=1&solo_staff=1&roles=COORDINADOR,ENCARGADO&limit=50
   */
  fetchMyEpSedesStaff(limit = 50): Observable<Array<{ id: number; label: string }>> {
    let params = new HttpParams()
      .set('solo_mias', '1')
      .set('solo_activas', '1')
      .set('solo_staff', '1')
      .set('roles', 'COORDINADOR,ENCARGADO')
      .set('limit', String(limit));

    return this.http.get<any>(`${this.base}/ep-sedes`, { params }).pipe(
      map(resp => pickItems<EpSedeRaw>(resp).map(x => ({
        id: x.id,
        label: x.label ?? x.nombre ?? `EP ${x.id}`
      })))
    );
  }

  /**
   * Periodos
   * GET /api/lookups/periodos?q=&solo_activos=1|0&limit=50
   */
  fetchPeriodos(q = '', soloActivos = false, limit = 50): Observable<Array<{ id: number; anio: number; ciclo: string; estado?: string }>> {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('solo_activos', soloActivos ? '1' : '0');
    if (q) params = params.set('q', q);

    return this.http.get<any>(`${this.base}/periodos`, { params }).pipe(
      map(resp => pickItems<PeriodoRaw>(resp).map(p => ({
        id: p.id,
        anio: p.anio,
        ciclo: String(p.ciclo),
        estado: p.estado
      })))
    );
  }
}
