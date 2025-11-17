import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  VmEvento,
  EventoFilter,
  VmImagen,
  Periodo,
  PeriodoRaw,
  EventoCreate,
  VmCategoriaEvento,
} from '../models/ev.models';

export type ApiResponse<T> = { ok: boolean; data: T; meta?: any };
export type Page<T> = { items?: T[]; total?: number };

@Injectable({ providedIn: 'root' })
export class EvApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string
  ) {
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  // Helpers
  private eventosUrl(): string {
    return `${this.baseUrl}/vm/eventos`;
  }
  private eventoCategoriasUrl(): string {
    return `${this.baseUrl}/vm/eventos/categorias`;
  }
  private lookupsUrl(): string {
    return `${this.baseUrl}/lookups`;
  }

  // ──────────────────────────────────────────────
  // 📅 EVENTOS
  // ──────────────────────────────────────────────

  listarEventos(
    filtro?: EventoFilter
  ): Observable<ApiResponse<Page<VmEvento>>> {
    let params = new HttpParams();

    if (filtro) {
      Object.entries(filtro).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params = params.set(k, String(v));
        }
      });
    }

    return this.http.get<any>(this.eventosUrl(), { params }).pipe(
      map((resp): ApiResponse<Page<VmEvento>> => {
        const items = pickItems<VmEvento>(resp);
        const meta = resp?.meta ?? resp?.data?.meta ?? undefined;

        const total =
          meta?.total ??
          resp?.total ??
          resp?.data?.total ??
          items.length;

        return {
          ok: resp?.ok ?? true,
          data: {
            items,
            total,
          },
          meta,
        };
      })
    );
  }

  obtenerEvento(id: number): Observable<ApiResponse<VmEvento>> {
    return this.http.get<ApiResponse<VmEvento>>(
      `${this.eventosUrl()}/${id}`
    );
  }

  crearEvento(
    payload: EventoCreate | Partial<VmEvento>
  ): Observable<ApiResponse<VmEvento>> {
    const {
      // ignoramos cualquier variante de target que venga del FE
      target_type,
      target_id,
      targetable_type,
      targetable_id,
      ep_sede_id,
      ...rest
    } = payload as any;

    const body: any = { ...rest };

    if (body.periodo_id !== undefined) {
      body.periodo_id = Number(body.periodo_id);
    }
    if (body.cupo_maximo !== undefined && body.cupo_maximo !== null) {
      body.cupo_maximo = Number(body.cupo_maximo);
    }
    if (
      body.categoria_evento_id !== undefined &&
      body.categoria_evento_id !== null
    ) {
      body.categoria_evento_id = Number(body.categoria_evento_id);
    }

    return this.http.post<ApiResponse<VmEvento>>(this.eventosUrl(), body);
  }

  actualizarEvento(
    id: number,
    payload: Partial<VmEvento>
  ): Observable<ApiResponse<VmEvento>> {
    return this.http.put<ApiResponse<VmEvento>>(
      `${this.eventosUrl()}/${id}`,
      payload
    );
  }

  eliminarEvento(id: number): Observable<void> {
    return this.http.delete<void>(`${this.eventosUrl()}/${id}`);
  }

  // ──────────────────────────────────────────────
  // 🗂 Categorías de evento
  // ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// 🗂 Categorías de evento
// ──────────────────────────────────────────────

listarCategoriasEvento(): Observable<VmCategoriaEvento[]> {
  return this.http.get<any>(this.eventoCategoriasUrl()).pipe(
    map((resp): VmCategoriaEvento[] => {
      // 1) Si el backend devuelve directamente un array
      if (Array.isArray(resp)) {
        return resp as VmCategoriaEvento[];
      }

      // 2) Si devuelve { ok, data: [...] }
      if (Array.isArray(resp?.data)) {
        return resp.data as VmCategoriaEvento[];
      }

      // 3) Si devuelve { ok, items: [...] }
      if (Array.isArray(resp?.items)) {
        return resp.items as VmCategoriaEvento[];
      }

      // 4) Si devuelve { ok, data: { items: [...] } }
      if (Array.isArray(resp?.data?.items)) {
        return resp.data.items as VmCategoriaEvento[];
      }

      // 5) Si devuelve { ok, data: { data: [...] } } (Resource Collection de Laravel)
      if (Array.isArray(resp?.data?.data)) {
        return resp.data.data as VmCategoriaEvento[];
      }

      // 6) Si usaste una clave "categorias" en el backend
      if (Array.isArray(resp?.categorias)) {
        return resp.categorias as VmCategoriaEvento[];
      }

      return [];
    })
  );
}



  // ──────────────────────────────────────────────
  // 🖼️ IMÁGENES DE EVENTO
  // ──────────────────────────────────────────────

  listarImagenesEvento(
    eventoId: number
  ): Observable<ApiResponse<VmImagen[]>> {
    return this.http
      .get<any>(`${this.eventosUrl()}/${eventoId}/imagenes`)
      .pipe(
        map((resp): ApiResponse<VmImagen[]> => ({
          ok: resp?.ok ?? true,
          data: pickItems<VmImagen>(resp),
          meta: resp?.meta,
        }))
      );
  }

  subirImagenEvento(
    eventoId: number,
    file: File
  ): Observable<ApiResponse<VmImagen>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ApiResponse<VmImagen>>(
      `${this.eventosUrl()}/${eventoId}/imagenes`,
      fd
    );
  }

  eliminarImagenEvento(
    eventoId: number,
    imagenId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.eventosUrl()}/${eventoId}/imagenes/${imagenId}`
    );
  }

  actualizarImagenEvento(
    eventoId: number,
    imagenId: number,
    payload: Partial<Pick<VmImagen, 'titulo' | 'visibilidad'>>
  ): Observable<ApiResponse<VmImagen>> {
    // Ojo: tu backend actual no tiene PATCH para imágenes de evento;
    // deja este método solo si existe la ruta.
    return this.http.patch<ApiResponse<VmImagen>>(
      `${this.eventosUrl()}/${eventoId}/imagenes/${imagenId}`,
      payload
    );
  }

  // ──────────────────────────────────────────────
  // 📚 LOOKUPS: PERIODOS
  // ──────────────────────────────────────────────

  fetchPeriodos(
    q = '',
    soloActivos = false,
    limit = 50
  ): Observable<Periodo[]> {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('solo_activos', soloActivos ? '1' : '0');
    if (q) params = params.set('q', q);

    return this.http
      .get<any>(`${this.lookupsUrl()}/periodos`, { params })
      .pipe(
        map((resp) =>
          pickItems<PeriodoRaw>(resp).map((p) => ({
            id: p.id,
            anio: p.anio,
            ciclo: String(p.ciclo),
            estado: p.estado,
            fecha_inicio: p.fecha_inicio,
            fecha_fin: p.fecha_fin,
          }))
        )
      );
  }
}

/**
 * Normaliza [], {items:[]}, {data:[]}, {data:{items:[]}}, {data:{data:[]}}
 */
function pickItems<T = any>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (Array.isArray(resp?.items)) return resp.items as T[];
  if (Array.isArray(resp?.data)) return resp.data as T[];
  if (Array.isArray(resp?.data?.items)) return resp.data.items as T[];
  if (Array.isArray(resp?.data?.data)) return resp.data.data as T[];
  return [];
}
