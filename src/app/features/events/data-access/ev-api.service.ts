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
  VmEventoInscritosData,
  VmEventoInscritosFilter,
  VmEventoCandidatosData,
  VmEventoCandidatosFilter,
  VmMisEventosData,
  VmMisEventosFilter,
  VmMisEventosPeriodo,
  VmEventoAlumnoItem,
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

  listarCategoriasEvento(): Observable<VmCategoriaEvento[]> {
    return this.http.get<any>(this.eventoCategoriasUrl()).pipe(
      map((resp): VmCategoriaEvento[] => {
        if (Array.isArray(resp)) {
          return resp as VmCategoriaEvento[];
        }
        if (Array.isArray(resp?.data)) {
          return resp.data as VmCategoriaEvento[];
        }
        if (Array.isArray(resp?.items)) {
          return resp.items as VmCategoriaEvento[];
        }
        if (Array.isArray(resp?.data?.items)) {
          return resp.data.items as VmCategoriaEvento[];
        }
        if (Array.isArray(resp?.data?.data)) {
          return resp.data.data as VmCategoriaEvento[];
        }
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

  // ──────────────────────────────────────────────
  // 👥 Inscritos / Candidatos de evento
  // ──────────────────────────────────────────────

  listarInscritosEvento(
    eventoId: number,
    filtro?: VmEventoInscritosFilter
  ): Observable<ApiResponse<VmEventoInscritosData>> {
    let params = new HttpParams();

    if (filtro?.estado && filtro.estado !== 'TODOS') {
      params = params.set('estado', filtro.estado);
    }

    if (filtro?.roles && filtro.roles.length > 0) {
      filtro.roles.forEach((rol) => {
        params = params.append('roles[]', rol);
      });
    }

    return this.http.get<ApiResponse<VmEventoInscritosData>>(
      `${this.eventosUrl()}/${eventoId}/inscritos`,
      { params }
    );
  }

  listarCandidatosEvento(
    eventoId: number,
    filtro?: VmEventoCandidatosFilter
  ): Observable<ApiResponse<VmEventoCandidatosData>> {
    let params = new HttpParams();

    if (filtro?.q) {
      params = params.set('q', filtro.q);
    }

    if (typeof filtro?.solo_elegibles === 'boolean') {
      params = params.set(
        'solo_elegibles',
        filtro.solo_elegibles ? '1' : '0'
      );
    }

    if (typeof filtro?.limit === 'number' && filtro.limit > 0) {
      params = params.set('limit', String(filtro.limit));
    }

    return this.http.get<ApiResponse<VmEventoCandidatosData>>(
      `${this.eventosUrl()}/${eventoId}/candidatos`,
      { params }
    );
  }

  // ──────────────────────────────────────────────
  // 👤 Mis eventos (alumno)
  // ──────────────────────────────────────────────

  listarMisEventos(
    filtro?: VmMisEventosFilter
  ): Observable<ApiResponse<VmMisEventosData>> {
    let params = new HttpParams();

    if (filtro?.periodo_id !== undefined && filtro.periodo_id !== null) {
      params = params.set('periodo_id', String(filtro.periodo_id));
    }

    if (filtro?.estado_participacion) {
      params = params.set(
        'estado_participacion',
        filtro.estado_participacion
      );
    }

    return this.http
      .get<any>(`${this.baseUrl}/vm/mis-eventos`, { params })
      .pipe(
        map((resp): ApiResponse<VmMisEventosData> => {
          const data = resp?.data ?? resp ?? {};

          const periodos: VmMisEventosPeriodo[] = (data.periodos ?? []).map(
            (p: any) => ({
              id: Number(p.id),
              anio: Number(p.anio),
              ciclo: String(p.ciclo),
              estado: p.estado,
              fecha_inicio: p.fecha_inicio ?? undefined,
              fecha_fin: p.fecha_fin ?? undefined,
              total_eventos: Number(p.total_eventos ?? 0),
            })
          );

          const eventos: VmEventoAlumnoItem[] = (data.eventos ?? []).map(
            (e: any) => ({
              id: Number(e.id),
              codigo: e.codigo,
              titulo: e.titulo,
              subtitulo: e.subtitulo ?? null,
              modalidad: e.modalidad,
              estado: e.estado,
              periodo_id: Number(e.periodo_id),
              requiere_inscripcion: !!e.requiere_inscripcion,
              cupo_maximo:
                e.cupo_maximo !== null && e.cupo_maximo !== undefined
                  ? Number(e.cupo_maximo)
                  : null,
              periodo: {
                id: Number(e.periodo?.id ?? e.periodo_id),
                anio: Number(e.periodo?.anio),
                ciclo: String(e.periodo?.ciclo),
                estado: e.periodo?.estado,
              },
              participacion: {
                id: Number(e.participacion?.id),
                estado: e.participacion?.estado,
              },
            })
          );

          return {
            ok: resp?.ok ?? true,
            data: {
              periodos,
              eventos,
            },
            meta: resp?.meta,
          };
        })
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
