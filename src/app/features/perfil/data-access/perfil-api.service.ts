// src/app/pages/perfil/data-access/perfil-api.service.ts
import { Inject, Injectable, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';

import {
  ChangePasswordPayload,
  MeResponse,
  ProfileUpdatePayload,
  SessionsResponse,
  SimpleOkResponse,
} from '../models/perfil.models';

@Injectable({ providedIn: 'root' })
export class PerfilApiService {
  private readonly baseUrl: string;

  constructor(
    private http: HttpClient,
    @Inject(API_URL) @Optional() base?: string
  ) {
    const b = base ?? '/api';
    this.baseUrl = b.endsWith('/') ? b.slice(0, -1) : b;
  }

  private usersUrl(): string {
    return `${this.baseUrl}/users`;
  }

  // ─────────────────────────────────────────────
  // 👤 Perfil
  // ─────────────────────────────────────────────

  /**
   * GET /api/users/me
   * Devuelve el UserDetailResource completo del backend.
   */
  getMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.usersUrl()}/me`);
  }

  /**
   * PUT /api/users/me
   * Actualiza solo campos permitidos del perfil.
   *
   * Si viene profile_photo (File), se manda multipart/form-data.
   * Si no, se manda JSON normal.
   */
  updateMe(
    payload: ProfileUpdatePayload
  ): Observable<MeResponse | SimpleOkResponse> {
    const hasFile = payload.profile_photo instanceof File;

    if (hasFile) {
      const fd = new FormData();

      if (payload.first_name !== undefined) {
        fd.append('first_name', payload.first_name);
      }
      if (payload.last_name !== undefined) {
        fd.append('last_name', payload.last_name);
      }
      if (payload.email !== undefined) {
        // permitimos null → lo mandamos como cadena vacía
        fd.append('email', payload.email ?? '');
      }
      if (payload.celular !== undefined) {
        fd.append('celular', payload.celular ?? '');
      }
      if (payload.religion !== undefined) {
        fd.append('religion', payload.religion ?? '');
      }
      if (payload.correo_institucional !== undefined) {
        fd.append(
          'correo_institucional',
          payload.correo_institucional ?? ''
        );
      }
      if (payload.expediente_id !== undefined) {
        fd.append('expediente_id', String(payload.expediente_id));
      }

      fd.append('profile_photo', payload.profile_photo as File);

      return this.http.put<MeResponse | SimpleOkResponse>(
        `${this.usersUrl()}/me`,
        fd
      );
    }

    const body: any = { ...payload };
    delete body.profile_photo;

    return this.http.put<MeResponse | SimpleOkResponse>(
      `${this.usersUrl()}/me`,
      body
    );
  }

  /**
   * PUT /api/users/me/password
   * Cambiar contraseña propia.
   */
  changePassword(
    dto: ChangePasswordPayload
  ): Observable<SimpleOkResponse> {
    return this.http.put<SimpleOkResponse>(
      `${this.usersUrl()}/me/password`,
      dto
    );
  }

  // ─────────────────────────────────────────────
  // 🔐 Sesiones
  // ─────────────────────────────────────────────

  /**
   * GET /api/users/me/sessions
   * Lista todas las sesiones del usuario autenticado.
   */
  getSessions(): Observable<SessionsResponse> {
    return this.http.get<SessionsResponse>(
      `${this.usersUrl()}/me/sessions`
    );
  }

  /**
   * Alias para que el componente use listSessions()
   * pero internamente sea getSessions().
   */
  listSessions(): Observable<SessionsResponse> {
    return this.getSessions();
  }

  /**
   * DELETE /api/users/me/sessions/{id}
   * Cierra una sesión concreta (si es la actual, también hace logout en backend).
   */
  closeSession(id: string): Observable<SimpleOkResponse> {
    return this.http.delete<SimpleOkResponse>(
      `${this.usersUrl()}/me/sessions/${encodeURIComponent(id)}`
    );
  }

  /**
   * Alias para que el componente use revokeSession()
   */
  revokeSession(id: string): Observable<SimpleOkResponse> {
    return this.closeSession(id);
  }

  /**
   * DELETE /api/users/me/sessions/others
   * Cierra todas las otras sesiones excepto la actual.
   *
   * Backend esperado:
   *   DELETE /api/users/me/sessions/others
   *   → devuelve { ok: true, sessions: [...] } o solo { ok: true }
   */
  closeOtherSessions(): Observable<SessionsResponse | SimpleOkResponse> {
    return this.http.delete<SessionsResponse | SimpleOkResponse>(
      `${this.usersUrl()}/me/sessions/others`
    );
  }

  /**
   * Alias para que el componente use revokeOtherSessions()
   */
  revokeOtherSessions(): Observable<SessionsResponse | SimpleOkResponse> {
    return this.closeOtherSessions();
  }

  // ─────────────────────────────────────────────
  // 🔎 Buscar usuario por username (opcional)
  // ─────────────────────────────────────────────

  /**
   * GET /api/users/by-username/{username}
   * Solo si el backend permite (user.view.any o el propio usuario).
   */
  getByUsername(username: string): Observable<MeResponse> {
    return this.http.get<MeResponse>(
      `${this.usersUrl()}/by-username/${encodeURIComponent(username)}`
    );
  }
}
