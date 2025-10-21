import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  ApiResponse,
  Page,
  AdRole,
  AdPermission,
  RoleFilter,
  RoleCreatePayload,
  RoleRenamePayload,
  AssignPermissionsPayload,
  UserLite,
  Universidad,
  Facultad,
  Sede,
  EscuelaProfesional,
  EpSedePayload,
  FacultadCreatePayload,
  SedeCreatePayload,
  EscuelaProfesionalCreatePayload,
} from '../models/ad.models';

@Injectable({ providedIn: 'root' })
export class AdApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string
  ) {
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  // Helpers
  private adminUrl(): string        { return `${this.baseUrl}/administrador`; }
  private rolesUrl(): string        { return `${this.adminUrl()}/roles`; }
  private permissionsUrl(): string  { return `${this.adminUrl()}/permissions`; }
  private universidadUrl(): string  { return `${this.adminUrl()}/universidad`; }
  private academicoUrl(): string    { return `${this.adminUrl()}/academico`; }

  // Normaliza respuesta: acepta {ok,data} o payload plano y lo vuelve ApiResponse<T>
  private asApi<T>(resp: any): ApiResponse<T> {
    if (resp && typeof resp === 'object' && 'ok' in resp && 'data' in resp) {
      return resp as ApiResponse<T>;
    }
    return { ok: true, data: resp as T };
  }

  /** Normaliza [], {items:[]}, {data:{items:[]}}, {data:[]} -> T[] */
  private pickItems<T = any>(resp: any): T[] {
    if (Array.isArray(resp)) return resp as T[];
    if (Array.isArray(resp?.items)) return resp.items as T[];
    if (Array.isArray(resp?.data)) return resp.data as T[];
    if (Array.isArray(resp?.data?.items)) return resp.data.items as T[];
    return [];
  }

  // ─────────────────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────────────────

  listarRoles(f?: RoleFilter): Observable<ApiResponse<AdRole[]>> {
    let params = new HttpParams();
    if (f?.guard)  params = params.set('guard', f.guard);
    if (f?.search) params = params.set('search', f.search);
    if (f?.page != null) params = params.set('page', String(f.page));

    return this.http
      .get<any>(this.rolesUrl(), { params })
      .pipe(map((r) => this.asApi<AdRole[]>(r)));
  }

  obtenerRol(id: number): Observable<ApiResponse<AdRole>> {
    return this.http
      .get<any>(`${this.rolesUrl()}/${id}`)
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  crearRol(payload: RoleCreatePayload): Observable<ApiResponse<AdRole>> {
    const body: RoleCreatePayload = {
      name: String(payload.name).trim(),
      ...(payload.guard_name ? { guard_name: String(payload.guard_name) } : {}),
    };
    return this.http
      .post<any>(this.rolesUrl(), body)
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  renombrarRol(id: number, payload: RoleRenamePayload): Observable<ApiResponse<AdRole>> {
    const body: RoleRenamePayload = {
      name: String(payload.name).trim(),
      ...(payload.guard_name ? { guard_name: String(payload.guard_name) } : {}),
    };
    return this.http
      .patch<any>(`${this.rolesUrl()}/${id}/rename`, body)
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  eliminarRol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.rolesUrl()}/${id}`);
  }

  // ─────────────────────────────────────────────────────────
  // PERMISOS DEL ROL
  // ─────────────────────────────────────────────────────────

  agregarPermisosARol(
    roleId: number,
    permissions: string[] | AssignPermissionsPayload
  ): Observable<ApiResponse<AdRole>> {
    const body: AssignPermissionsPayload = Array.isArray(permissions)
      ? { permissions }
      : permissions;

    return this.http
      .post<any>(`${this.rolesUrl()}/${roleId}/permissions/assign`, body)
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  asignarPermisosARol(
    roleId: number,
    permissions: string[] | AssignPermissionsPayload
  ): Observable<ApiResponse<AdRole>> {
    const body: AssignPermissionsPayload = Array.isArray(permissions)
      ? { permissions }
      : permissions;

    return this.http
      .put<any>(`${this.rolesUrl()}/${roleId}/permissions`, body)
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  revocarPermisosDeRol(
    roleId: number,
    permissions: string[]
  ): Observable<ApiResponse<AdRole>> {
    const body: AssignPermissionsPayload = { permissions };
    return this.http
      .request<any>('DELETE', `${this.rolesUrl()}/${roleId}/permissions`, { body })
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  listarPermisos(guard?: string): Observable<ApiResponse<AdPermission[]>> {
    let params = new HttpParams();
    if (guard) params = params.set('guard', guard);

    return this.http
      .get<any>(this.permissionsUrl(), { params })
      .pipe(map((r) => this.asApi<AdPermission[]>(r)));
  }

  listarUsuariosDeRol(
    roleId: number,
    page = 1,
    perPage = 15
  ): Observable<ApiResponse<Page<UserLite>>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    return this.http
      .get<any>(`${this.rolesUrl()}/${roleId}/users`, { params })
      .pipe(
        map((resp) => {
          const items = this.pickItems<UserLite>(resp);
          const total =
            resp?.total ??
            resp?.meta?.total ??
            (Array.isArray(items) ? items.length : undefined);

          const pageOut: Page<UserLite> = {
            items,
            total,
            page: Number(resp?.meta?.current_page ?? page) || undefined,
            per_page: Number(resp?.meta?.per_page ?? perPage) || undefined,
          };

          return this.asApi<Page<UserLite>>(
            resp?.ok ? { ok: resp.ok, data: pageOut, meta: resp.meta } : pageOut
          );
        })
      );
  }

  // ─────────────────────────────────────────────────────────
  // UNIVERSIDAD (admin)
  // ─────────────────────────────────────────────────────────

  obtenerUniversidad(): Observable<ApiResponse<Universidad>> {
    return this.http
      .get<any>(this.universidadUrl())
      .pipe(map(r => this.asApi<Universidad>(r)));
  }

  actualizarUniversidad(payload: Partial<Universidad>): Observable<ApiResponse<Universidad>> {
    const body = {
      codigo:                String(payload.codigo ?? ''),
      nombre:                String(payload.nombre ?? ''),
      tipo_gestion:          String(payload.tipo_gestion ?? ''),
      estado_licenciamiento: String(payload.estado_licenciamiento ?? ''),
    };
    return this.http
      .put<any>(this.universidadUrl(), body)
      .pipe(map(r => this.asApi<Universidad>(r)));
  }

  setUniversidadLogo(file: File): Observable<ApiResponse<Universidad>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http
      .post<any>(`${this.universidadUrl()}/logo`, fd)
      .pipe(map(r => this.asApi<Universidad>(r)));
  }

  setUniversidadPortada(file: File): Observable<ApiResponse<Universidad>> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http
      .post<any>(`${this.universidadUrl()}/portada`, fd)
      .pipe(map(r => this.asApi<Universidad>(r)));
  }

  // ─────────────────────────────────────────────────────────
  // ACADÉMICO
  // ─────────────────────────────────────────────────────────

  /** FACULTADES */
  listarFacultades(q?: string, page = 1, per_page = 15): Observable<ApiResponse<Page<Facultad>>> {
    let params = new HttpParams().set('page', String(page)).set('per_page', String(per_page));
    if (q) params = params.set('q', q);
    return this.http.get<any>(`${this.academicoUrl()}/facultades`, { params }).pipe(
      map((resp) => {
        const items = this.pickItems<Facultad>(resp);
        const total = resp?.total ?? resp?.meta?.total ?? (Array.isArray(items) ? items.length : undefined);

        const pageOut: Page<Facultad> = {
          items,
          total,
          page: Number(resp?.meta?.current_page ?? page) || undefined,
          per_page: Number(resp?.meta?.per_page ?? per_page) || undefined,
        };

        return this.asApi<Page<Facultad>>(resp?.ok ? { ok: resp.ok, data: pageOut, meta: resp.meta } : pageOut);
      })
    );
  }

  obtenerFacultad(id: number): Observable<ApiResponse<Facultad>> {
    return this.http.get<any>(`${this.academicoUrl()}/facultades/${id}`)
      .pipe(map((r) => this.asApi<Facultad>(r)));
  }

  crearFacultad(payload: FacultadCreatePayload): Observable<ApiResponse<Facultad>> {
    const body = {
      universidad_id: payload.universidad_id,
      codigo: String(payload.codigo).trim(),
      nombre: String(payload.nombre).trim(),
    };
    return this.http.post<any>(`${this.academicoUrl()}/facultades`, body)
      .pipe(map((r) => this.asApi<Facultad>(r)));
  }

  actualizarFacultad(id: number, payload: Partial<FacultadCreatePayload>): Observable<ApiResponse<Facultad>> {
    const body: any = {};
    if (payload.codigo !== undefined) body.codigo = String(payload.codigo);
    if (payload.nombre !== undefined) body.nombre = String(payload.nombre);
    if (payload.universidad_id !== undefined) body.universidad_id = payload.universidad_id;
    return this.http.put<any>(`${this.academicoUrl()}/facultades/${id}`, body)
      .pipe(map((r) => this.asApi<Facultad>(r)));
  }

  eliminarFacultad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.academicoUrl()}/facultades/${id}`);
  }

  /** SEDES */
  listarSedes(q?: string, page = 1, per_page = 15): Observable<ApiResponse<Page<Sede>>> {
    let params = new HttpParams().set('page', String(page)).set('per_page', String(per_page));
    if (q) params = params.set('q', q);
    return this.http.get<any>(`${this.academicoUrl()}/sedes`, { params }).pipe(
      map((resp) => {
        const items = this.pickItems<Sede>(resp);
        const total = resp?.total ?? resp?.meta?.total ?? (Array.isArray(items) ? items.length : undefined);

        const pageOut: Page<Sede> = {
          items,
          total,
          page: Number(resp?.meta?.current_page ?? page) || undefined,
          per_page: Number(resp?.meta?.per_page ?? per_page) || undefined,
        };

        return this.asApi<Page<Sede>>(resp?.ok ? { ok: resp.ok, data: pageOut, meta: resp.meta } : pageOut);
      })
    );
  }

  obtenerSede(id: number): Observable<ApiResponse<Sede>> {
    return this.http.get<any>(`${this.academicoUrl()}/sedes/${id}`)
      .pipe(map((r) => this.asApi<Sede>(r)));
  }

  crearSede(payload: SedeCreatePayload): Observable<ApiResponse<Sede>> {
    const body = {
      universidad_id: payload.universidad_id,
      nombre: String(payload.nombre).trim(),
      es_principal: payload.es_principal ?? false,
      esta_suspendida: payload.esta_suspendida ?? false,
    };
    return this.http.post<any>(`${this.academicoUrl()}/sedes`, body)
      .pipe(map((r) => this.asApi<Sede>(r)));
  }

  actualizarSede(id: number, payload: Partial<SedeCreatePayload>): Observable<ApiResponse<Sede>> {
    const body: any = {};
    if (payload.nombre !== undefined) body.nombre = String(payload.nombre);
    if (payload.universidad_id !== undefined) body.universidad_id = payload.universidad_id;
    if (payload.es_principal !== undefined) body.es_principal = payload.es_principal;
    if (payload.esta_suspendida !== undefined) body.esta_suspendida = payload.esta_suspendida;
    return this.http.put<any>(`${this.academicoUrl()}/sedes/${id}`, body)
      .pipe(map((r) => this.asApi<Sede>(r)));
  }

  eliminarSede(id: number): Observable<void> {
    return this.http.delete<void>(`${this.academicoUrl()}/sedes/${id}`);
  }

  /** ESCUELAS PROFESIONALES */

  /**
   * Listado general de EP.
   * Si envías `sedeId`, el BE filtrará por ?sede_id=... y devolverá el pivot hacia esa sede.
   */
  listarEscuelas(q?: string, page = 1, per_page = 15, sedeId?: number): Observable<ApiResponse<Page<EscuelaProfesional>>> {
    let params = new HttpParams().set('page', String(page)).set('per_page', String(per_page));
    if (q) params = params.set('q', q);
    if (sedeId != null) params = params.set('sede_id', String(sedeId));
    return this.http.get<any>(`${this.academicoUrl()}/escuelas-profesionales`, { params }).pipe(
      map((resp) => {
        const items = this.pickItems<EscuelaProfesional>(resp);
        const total = resp?.total ?? resp?.meta?.total ?? (Array.isArray(items) ? items.length : undefined);

        const pageOut: Page<EscuelaProfesional> = {
          items,
          total,
          page: Number(resp?.meta?.current_page ?? page) || undefined,
          per_page: Number(resp?.meta?.per_page ?? per_page) || undefined,
        };

        return this.asApi<Page<EscuelaProfesional>>(resp?.ok ? { ok: resp.ok, data: pageOut, meta: resp.meta } : pageOut);
      })
    );
  }

  /**
   * Listado de EP por sede.
   * GET /administrador/academico/sedes/{sedeId}/escuelas
   */
  listarEscuelasDeSede(
    sedeId: number,
    q?: string,
    page = 1,
    per_page = 15
  ): Observable<ApiResponse<Page<EscuelaProfesional>>> {
    let params = new HttpParams().set('page', String(page)).set('per_page', String(per_page));
    if (q) params = params.set('q', q);

    return this.http.get<any>(`${this.academicoUrl()}/sedes/${sedeId}/escuelas`, { params }).pipe(
      map((resp) => {
        const items = this.pickItems<EscuelaProfesional>(resp);
        const total = resp?.total ?? resp?.meta?.total ?? (Array.isArray(items) ? items.length : undefined);

        const pageOut: Page<EscuelaProfesional> = {
          items,
          total,
          page: Number(resp?.meta?.current_page ?? page) || undefined,
          per_page: Number(resp?.meta?.per_page ?? per_page) || undefined,
        };

        return this.asApi<Page<EscuelaProfesional>>(resp?.ok ? { ok: resp.ok, data: pageOut, meta: resp.meta } : pageOut);
      })
    );
  }

  obtenerEscuela(id: number): Observable<ApiResponse<EscuelaProfesional>> {
    return this.http.get<any>(`${this.academicoUrl()}/escuelas-profesionales/${id}`)
      .pipe(map((r) => this.asApi<EscuelaProfesional>(r)));
  }

  crearEscuela(payload: EscuelaProfesionalCreatePayload): Observable<ApiResponse<EscuelaProfesional>> {
    const body = {
      facultad_id: payload.facultad_id,
      codigo: String(payload.codigo).trim(),
      nombre: String(payload.nombre).trim(),
    };
    return this.http.post<any>(`${this.academicoUrl()}/escuelas-profesionales`, body)
      .pipe(map((r) => this.asApi<EscuelaProfesional>(r)));
  }

  actualizarEscuela(id: number, payload: Partial<EscuelaProfesionalCreatePayload>): Observable<ApiResponse<EscuelaProfesional>> {
    const body: any = {};
    if (payload.codigo !== undefined) body.codigo = String(payload.codigo);
    if (payload.nombre !== undefined) body.nombre = String(payload.nombre);
    if (payload.facultad_id !== undefined) body.facultad_id = payload.facultad_id;
    return this.http.put<any>(`${this.academicoUrl()}/escuelas-profesionales/${id}`, body)
      .pipe(map((r) => this.asApi<EscuelaProfesional>(r)));
  }

  eliminarEscuela(id: number): Observable<void> {
    return this.http.delete<void>(`${this.academicoUrl()}/escuelas-profesionales/${id}`);
  }

  // ─────────────────────────────────────────────────────────
  // VINCULACIÓN EP <-> SEDE (tabla ep_sede)
  // ─────────────────────────────────────────────────────────

  attachSedeToEscuela(escuelaId: number, payload: EpSedePayload): Observable<ApiResponse<{ id: number }>> {
    const body: any = {
      sede_id: payload.sede_id,
      vigente_desde: payload.vigente_desde ?? null,
      vigente_hasta: payload.vigente_hasta ?? null,
    };
    return this.http.post<any>(`${this.academicoUrl()}/escuelas-profesionales/${escuelaId}/sedes`, body)
      .pipe(map((r) => this.asApi<{ id: number }>(r)));
  }

  updateEscuelaSedeVigencia(escuelaId: number, sedeId: number, payload: Partial<EpSedePayload>): Observable<void> {
    const body: any = {};
    if (payload.vigente_desde !== undefined) body.vigente_desde = payload.vigente_desde;
    if (payload.vigente_hasta !== undefined) body.vigente_hasta = payload.vigente_hasta;
    return this.http.put<void>(`${this.academicoUrl()}/escuelas-profesionales/${escuelaId}/sedes/${sedeId}`, body);
  }

  detachEscuelaFromSede(escuelaId: number, sedeId: number): Observable<void> {
    return this.http.delete<void>(`${this.academicoUrl()}/escuelas-profesionales/${escuelaId}/sedes/${sedeId}`);
  }
}
