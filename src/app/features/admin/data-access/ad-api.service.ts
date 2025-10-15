// src/app/features/admin/data-access/ad-api.service.ts
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
    // Backend: PATCH /roles/{role}/rename
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

  /**
   * Añade permisos (suma al set actual) -> POST /roles/{id}/permissions/assign
   */
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

  /**
   * Sincroniza el set completo de permisos (reemplaza) -> PUT /roles/{id}/permissions
   */
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

  /**
   * Revoca una lista puntual de permisos -> DELETE /roles/{id}/permissions (con body)
   */
  revocarPermisosDeRol(
    roleId: number,
    permissions: string[]
  ): Observable<ApiResponse<AdRole>> {
    const body: AssignPermissionsPayload = { permissions };
    return this.http
      .request<any>('DELETE', `${this.rolesUrl()}/${roleId}/permissions`, { body })
      .pipe(map((r) => this.asApi<AdRole>(r)));
  }

  // ─────────────────────────────────────────────────────────
  // PERMISOS (catálogo por guard)
  // ─────────────────────────────────────────────────────────
  listarPermisos(guard?: string): Observable<ApiResponse<AdPermission[]>> {
    let params = new HttpParams();
    if (guard) params = params.set('guard', guard);

    return this.http
      .get<any>(this.permissionsUrl(), { params })
      .pipe(map((r) => this.asApi<AdPermission[]>(r)));
  }

  // ─────────────────────────────────────────────────────────
  // (Opcional) Usuarios de un rol si el BE lo expone
  // ─────────────────────────────────────────────────────────
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
}
