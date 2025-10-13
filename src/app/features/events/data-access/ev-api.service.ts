// features/events/data-access/ev-api.service.ts
import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import { VmEvento, EventoFilter, VmImagen, Periodo, PeriodoRaw } from '../models/ev.models';

export type ApiResponse<T> = { ok: boolean; data: T; meta?: any };
export type Page<T> = { items?: T[]; total?: number };

@Injectable({ providedIn: 'root' })
export class EvApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string
  ) {
    // fallback + normalización para evitar doble slash
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  // Helpers seguros
  private eventosUrl(): string { return `${this.baseUrl}/vm/eventos`; }
  private lookupsUrl(): string { return `${this.baseUrl}/lookups`; }

  // ──────────────────────────────────────────────
  // 📅 EVENTOS
  // ──────────────────────────────────────────────

  listarEventos(filtro?: EventoFilter): Observable<ApiResponse<VmEvento[]>> {
    let params = new HttpParams();
    if (filtro) {
      Object.entries(filtro).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params = params.set(k, String(v));
        }
      });
    }
    return this.http.get<ApiResponse<VmEvento[]>>(this.eventosUrl(), { params });
  }

  obtenerEvento(id: number): Observable<ApiResponse<VmEvento>> {
    return this.http.get<ApiResponse<VmEvento>>(`${this.eventosUrl()}/${id}`);
  }

  // ...
  crearEvento(payload: Partial<VmEvento>): Observable<ApiResponse<VmEvento>> {
    // Mapear nombres FE -> BE
    const body: any = { ...payload };

    // Si vienen como targetable_*, conviértelos a target_*
    if (body.targetable_type && !body.target_type) {
      body.target_type = String(body.targetable_type).toLowerCase(); // 'ep_sede' | 'sede' | 'facultad'
      delete body.targetable_type;
    }
    if (body.targetable_id !== undefined && !body.target_id) {
      body.target_id = Number(body.targetable_id);
      delete body.targetable_id;
    }

    // (Opcional) Asegura tipos básicos
    if (body.periodo_id !== undefined) body.periodo_id = Number(body.periodo_id);
    if (body.cupo_maximo !== undefined && body.cupo_maximo !== null) {
      body.cupo_maximo = Number(body.cupo_maximo);
    }

    return this.http.post<ApiResponse<VmEvento>>(this.eventosUrl(), body);
  }


  actualizarEvento(id: number, payload: Partial<VmEvento>): Observable<ApiResponse<VmEvento>> {
    return this.http.put<ApiResponse<VmEvento>>(`${this.eventosUrl()}/${id}`, payload);
  }



  // ──────────────────────────────────────────────
  // 🖼️ IMÁGENES DE EVENTO
  // ──────────────────────────────────────────────

  listarImagenesEvento(eventoId: number): Observable<ApiResponse<VmImagen[]>> {
    return this.http.get<ApiResponse<VmImagen[]>>(`${this.eventosUrl()}/${eventoId}/imagenes`);
  }

  subirImagenEvento(eventoId: number, file: File): Observable<ApiResponse<VmImagen>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<VmImagen>>(`${this.eventosUrl()}/${eventoId}/imagenes`, fd);
  }

  eliminarImagenEvento(eventoId: number, imagenId: number): Observable<void> {
    return this.http.delete<void>(`${this.eventosUrl()}/${eventoId}/imagenes/${imagenId}`);
  }

  actualizarImagenEvento(
    eventoId: number,
    imagenId: number,
    payload: Partial<Pick<VmImagen, 'titulo' | 'visibilidad'>>
  ): Observable<ApiResponse<VmImagen>> {
    return this.http.patch<ApiResponse<VmImagen>>(
      `${this.eventosUrl()}/${eventoId}/imagenes/${imagenId}`,
      payload
    );
  }

  // ──────────────────────────────────────────────
  // 📚 LOOKUPS: PERIODOS
  // ──────────────────────────────────────────────

  fetchPeriodos(q = '', soloActivos = false, limit = 50): Observable<Periodo[]> {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('solo_activos', soloActivos ? '1' : '0');
    if (q) params = params.set('q', q);

    return this.http.get<any>(`${this.lookupsUrl()}/periodos`, { params }).pipe(
      map(resp =>
        pickItems<PeriodoRaw>(resp).map(p => ({
          id: p.id,
          anio: p.anio,
          ciclo: String(p.ciclo),
          estado: p.estado,
        }))
      )
    );
  }
}

/** Normaliza [], {items:[]}, {data:{items:[]}}, {data:[]} */
function pickItems<T = any>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (Array.isArray(resp?.items)) return resp.items as T[];
  if (Array.isArray(resp?.data)) return resp.data as T[];
  if (Array.isArray(resp?.data?.items)) return resp.data.items as T[];
  return [];
}
