// src/app/features/ep-sede-staff/data-access/ep-sede-staff-api.service.ts
import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';

import {
  ApiResponse,
  EpSedeStaffContextPayload,
  EpSedeStaffCurrentPayload,
  EpSedeStaffHistoryPayload,
  EpSedeStaffAssignInput,
  EpSedeStaffAssignPayload,
  EpSedeStaffUnassignInput,
  EpSedeStaffUnassignPayload,
  EpSedeStaffReinstateInput,
  EpSedeStaffDelegateInput,
  EpSedeStaffCreateAndAssignInput,
  EpSedeStaffCreateAndAssignResponse,
  EpSedeStaffLookupPayload,
} from '../models/ep-sede-staff.models';

@Injectable({ providedIn: 'root' })
export class EpSedeStaffApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /** Base URL para el staff de una EP-Sede específica. */
  private staffUrl(epSedeId: number): string {
    return `${this.base}/ep-sedes/${epSedeId}/staff`;
  }

  /** Convierte error de red en ApiFail<T> */
  private toFail<T>(e: any, fallbackMsg: string): ApiResponse<T> {
    const message =
      e?.error?.message ||
      e?.message ||
      fallbackMsg;

    const meta: any = { status: e?.status ?? -1 };
    return { ok: false, message, meta };
  }

  // ──────────────────────────────────────────────
  // CONTEXTO DEL PANEL
  // ──────────────────────────────────────────────

  /**
   * Contexto general del panel de staff para el usuario autenticado.
   * Backend: GET /api/ep-sedes/staff/context
   */
  obtenerContextoPanel(): Observable<ApiResponse<EpSedeStaffContextPayload>> {
    return this.http
      .get<EpSedeStaffContextPayload>(`${this.base}/ep-sedes/staff/context`)
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffContextPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffContextPayload>(
              err,
              'No se pudo obtener el contexto del panel de staff'
            )
          )
        )
      );
  }

  // ──────────────────────────────────────────────
  // STAFF ACTUAL
  // ──────────────────────────────────────────────

  /**
   * Staff actual de la EP-Sede (COORDINADOR / ENCARGADO).
   * Backend: GET /api/ep-sedes/{epSedeId}/staff
   */
  obtenerStaffActual(
    epSedeId: number
  ): Observable<ApiResponse<EpSedeStaffCurrentPayload>> {
    return this.http
      .get<EpSedeStaffCurrentPayload>(this.staffUrl(epSedeId))
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffCurrentPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffCurrentPayload>(
              err,
              'No se pudo obtener el staff actual'
            )
          )
        )
      );
  }

  // ──────────────────────────────────────────────
  // HISTORIAL
  // ──────────────────────────────────────────────

  /**
   * Historial de cambios de staff en la EP-Sede.
   * Backend: GET /api/ep-sedes/{epSedeId}/staff/history
   */
  obtenerHistorialStaff(
    epSedeId: number
  ): Observable<ApiResponse<EpSedeStaffHistoryPayload>> {
    return this.http
      .get<EpSedeStaffHistoryPayload>(`${this.staffUrl(epSedeId)}/history`)
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffHistoryPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffHistoryPayload>(
              err,
              'No se pudo obtener el historial de staff'
            )
          )
        )
      );
  }

  // ──────────────────────────────────────────────
  // LOOKUP POR CORREO
  // ──────────────────────────────────────────────

  /**
   * Buscar perfil de usuario/expediente por correo (email / correo_institucional).
   * Backend: GET /api/ep-sedes/{epSedeId}/staff/lookup?email=...
   */
  buscarPerfilPorCorreo(
    epSedeId: number,
    email: string
  ): Observable<ApiResponse<EpSedeStaffLookupPayload>> {
    const params = new HttpParams().set('email', email);
    return this.http
      .get<EpSedeStaffLookupPayload>(
        `${this.staffUrl(epSedeId)}/lookup`,
        { params }
      )
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffLookupPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffLookupPayload>(
              err,
              'No se pudo buscar el perfil por correo'
            )
          )
        )
      );
  }

  // ──────────────────────────────────────────────
  // ASSIGN / UNASSIGN / REINSTATE / DELEGATE
  // ──────────────────────────────────────────────

  /**
   * Asignar un COORDINADOR / ENCARGADO (usuario ya existente).
   * Backend: POST /api/ep-sedes/{epSedeId}/staff/assign
   */
  asignarStaff(
    epSedeId: number,
    body: EpSedeStaffAssignInput
  ): Observable<ApiResponse<EpSedeStaffAssignPayload>> {
    return this.http
      .post<EpSedeStaffAssignPayload>(`${this.staffUrl(epSedeId)}/assign`, body)
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffAssignPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffAssignPayload>(
              err,
              'No se pudo asignar staff'
            )
          )
        )
      );
  }

  /**
   * Desasignar COORDINADOR / ENCARGADO actual.
   * Backend: POST /api/ep-sedes/{epSedeId}/staff/unassign
   */
  desasignarStaff(
    epSedeId: number,
    body: EpSedeStaffUnassignInput
  ): Observable<ApiResponse<EpSedeStaffUnassignPayload>> {
    return this.http
      .post<EpSedeStaffUnassignPayload>(
        `${this.staffUrl(epSedeId)}/unassign`,
        body
      )
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffUnassignPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffUnassignPayload>(
              err,
              'No se pudo desasignar staff'
            )
          )
        )
      );
  }

  /**
   * Reincorporar a un usuario como COORDINADOR / ENCARGADO.
   * Backend: POST /api/ep-sedes/{epSedeId}/staff/reinstate
   */
  reincorporarStaff(
    epSedeId: number,
    body: EpSedeStaffReinstateInput
  ): Observable<ApiResponse<EpSedeStaffAssignPayload>> {
    return this.http
      .post<EpSedeStaffAssignPayload>(
        `${this.staffUrl(epSedeId)}/reinstate`,
        body
      )
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffAssignPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffAssignPayload>(
              err,
              'No se pudo reincorporar staff'
            )
          )
        )
      );
  }

  /**
   * Delegar ENCARGADO interino (solo role ENCARGADO).
   * Backend: POST /api/ep-sedes/{epSedeId}/staff/delegate
   */
  delegarEncargadoInterino(
    epSedeId: number,
    body: EpSedeStaffDelegateInput
  ): Observable<ApiResponse<EpSedeStaffAssignPayload>> {
    return this.http
      .post<EpSedeStaffAssignPayload>(
        `${this.staffUrl(epSedeId)}/delegate`,
        body
      )
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffAssignPayload>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffAssignPayload>(
              err,
              'No se pudo delegar encargado interino'
            )
          )
        )
      );
  }

  // ──────────────────────────────────────────────
  // CREAR USUARIO + EXPEDIENTE + ASIGNACIÓN
  // ──────────────────────────────────────────────

  /**
   * Crear un usuario (docente/encargado) y asignarlo como COORDINADOR o ENCARGADO.
   * Backend: POST /api/ep-sedes/{epSedeId}/staff/create-and-assign
   */
  crearYAsignarStaff(
    epSedeId: number,
    body: EpSedeStaffCreateAndAssignInput
  ): Observable<ApiResponse<EpSedeStaffCreateAndAssignResponse>> {
    return this.http
      .post<EpSedeStaffCreateAndAssignResponse>(
        `${this.staffUrl(epSedeId)}/create-and-assign`,
        body
      )
      .pipe(
        map(
          payload =>
            ({
              ok: true,
              data: payload,
              meta: undefined,
            }) as ApiResponse<EpSedeStaffCreateAndAssignResponse>
        ),
        catchError(err =>
          of(
            this.toFail<EpSedeStaffCreateAndAssignResponse>(
              err,
              'No se pudo crear y asignar staff'
            )
          )
        )
      );
  }
}
