import { Inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams,
  HttpResponse,
  HttpHeaders,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, map, catchError, of, throwError } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';
import {
  ApiResponse, AlumnoAgendaResponse, StaffAgendaResponse, Page, VmProyecto, VmProyectoArbol,
  ProyectoCreate, VmProceso, ProcesoCreate, VmSesion, SesionCreate, SesionesBatchCreate,
  VmEvento, EventoCreate, Imagen, Participante, ParticipanteCreate, Registro, RegistroCreate,
  ProyectosAlumnoData, EnrolResponse, VmVentanaManual, VmQrVentanaQR, ListadoAsistenciaRow,
  ValidarAsistenciasResp, Id,
  // ─── Tipos para reportes de inscripción ───
  VmProyectoResumen, InscritosResponseData, CandidatosResponseData,
  // ─── Tipos de /vm/sesiones ───
  ProcesoSesionesGroup, SesionesListResponse,
  ProyectoIndexPage,
  // ─── NUEVO: tipo para poll condicional ───
  PollResult,
  // ─── 👇 NUEVOS tipos para asistencia manual extendida ───
  VmAsistencia,
  ParticipantesResponse,
  JustificarAsistenciaPayload,
  JustificarAsistenciaResponse,
} from '../models/proyecto.models';

@Injectable({ providedIn: 'root' })
export class VmApiService {
  constructor(
    private http: HttpClient,
    @Inject(API_URL) private base: string
  ) {}

  // ---------- Proyectos ----------
  crearProyecto(payload: ProyectoCreate): Observable<ApiResponse<VmProyecto>> {
    return this.http.post<ApiResponse<VmProyecto>>(`${this.base}/vm/proyectos`, payload);
  }

  obtenerProyectoArbol(id: Id): Observable<ApiResponse<VmProyectoArbol>> {
    return this.http.get<ApiResponse<VmProyectoArbol>>(`${this.base}/vm/proyectos/${id}`);
  }

  obtenerProyectoArbolAlumno(id: Id): Observable<ApiResponse<VmProyectoArbol>> {
    return this.http.get<ApiResponse<VmProyectoArbol>>(`${this.base}/vm/alumno/proyectos/${id}`);
  }

  obtenerProyecto(id: Id): Observable<ApiResponse<VmProyecto>> {
    return this.http.get<ApiResponse<VmProyectoArbol>>(`${this.base}/vm/proyectos/${id}`)
      .pipe(map(r => r.ok ? ({ ok: true, data: r.data.proyecto }) : r as any));
  }

  actualizarProyecto(id: Id, payload: Partial<ProyectoCreate>): Observable<ApiResponse<VmProyecto>> {
    return this.http.put<ApiResponse<VmProyecto>>(`${this.base}/vm/proyectos/${id}`, payload);
  }

  publicarProyecto(id: Id): Observable<ApiResponse<VmProyecto>> {
    return this.http.put<ApiResponse<VmProyecto>>(`${this.base}/vm/proyectos/${id}/publicar`, {});
  }

  eliminarProyecto(id: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/proyectos/${id}`);
  }

  listarProyectos(params?: {
    q?: string;
    page?: number;
    ep_sede_id?: Id;
    periodo_id?: Id;
    estado?: string;
    nivel?: number;
    tipo?: 'LIBRE' | 'VINCULADO';
  }): Observable<ApiResponse<Page<VmProyecto>>> {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return this.http.get<ApiResponse<Page<VmProyecto>>>(`${this.base}/vm/proyectos`, { params: p });
  }

  nivelesDisponibles(params: { ep_sede_id: Id; periodo_id: Id; exclude_proyecto_id?: Id; }): Observable<ApiResponse<number[]>> {
    let p = new HttpParams({ fromObject: Object.entries(params).reduce((a,[k,v]) => (a[k]=String(v), a), {} as any) });
    return this.http.get<ApiResponse<number[]>>(`${this.base}/vm/proyectos/niveles-disponibles`, { params: p });
  }

  // ---------- Procesos ----------
  crearProceso(proyectoId: Id, payload: ProcesoCreate): Observable<ApiResponse<VmProceso>> {
    return this.http.post<ApiResponse<VmProceso>>(`${this.base}/vm/proyectos/${proyectoId}/procesos`, payload);
  }
  obtenerProcesos(proyectoId: Id): Observable<ApiResponse<VmProceso[]>> {
    return this.http.get<ApiResponse<VmProceso[]>>(`${this.base}/vm/proyectos/${proyectoId}/procesos`);
  }
  actualizarProceso(proyectoId: Id, procesoId: Id, payload: Partial<ProcesoCreate>): Observable<ApiResponse<VmProceso>> {
    return this.http.put<ApiResponse<VmProceso>>(`${this.base}/vm/proyectos/${proyectoId}/procesos/${procesoId}`, payload);
  }
  eliminarProceso(proyectoId: Id, procesoId: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/proyectos/${proyectoId}/procesos/${procesoId}`);
  }

  // ---------- Sesiones ----------
  crearSesion(procesoId: Id, payload: SesionCreate): Observable<ApiResponse<VmSesion>> {
    const batch = { mode: 'list' as const, fechas: [payload.fecha], hora_inicio: payload.hora_inicio, hora_fin: payload.hora_fin };
    return this.http.post<ApiResponse<VmSesion[]>>(`${this.base}/vm/procesos/${procesoId}/sesiones/batch`, batch)
      .pipe(map(r => (r.ok ? ({ ok: true, data: (r.data?.[0] as VmSesion) }) : (r as any))));
  }
  crearSesionesBatch(procesoId: Id, payload: SesionesBatchCreate): Observable<ApiResponse<VmSesion[]>> {
    return this.http.post<ApiResponse<VmSesion[]>>(`${this.base}/vm/procesos/${procesoId}/sesiones/batch`, payload);
  }
  obtenerSesiones(procesoId: Id): Observable<ApiResponse<VmSesion[]>> {
    return this.http.get<ApiResponse<VmSesion[]>>(`${this.base}/vm/procesos/${procesoId}/sesiones`);
  }
  actualizarSesion(procesoId: Id, sesionId: Id, payload: Partial<SesionCreate>): Observable<ApiResponse<VmSesion>> {
    return this.http.put<ApiResponse<VmSesion>>(`${this.base}/vm/procesos/${procesoId}/sesiones/${sesionId}`, payload);
  }
  eliminarSesion(procesoId: Id, sesionId: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/procesos/${procesoId}/sesiones/${sesionId}`);
  }

  // ---------- Eventos ----------
  crearEvento(payload: EventoCreate): Observable<ApiResponse<VmEvento>> {
    return this.http.post<ApiResponse<VmEvento>>(`${this.base}/vm/eventos`, payload);
  }

  // ---------- Imágenes ----------
  listarImagenesProyecto(id: Id): Observable<ApiResponse<Imagen[]>> {
    return this.http.get<ApiResponse<Imagen[]>>(`${this.base}/vm/proyectos/${id}/imagenes`);
  }
  subirImagenProyecto(id: Id, file: File): Observable<ApiResponse<Imagen>> {
    const fd = new FormData(); fd.append('file', file);
    return this.http.post<ApiResponse<Imagen>>(`${this.base}/vm/proyectos/${id}/imagenes`, fd);
  }
  eliminarImagenProyecto(id: Id, imagenId: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/proyectos/${id}/imagenes/${imagenId}`);
  }

  // ---------- Participantes ----------
  agregarParticipante(proyectoId: Id, payload: ParticipanteCreate): Observable<ApiResponse<Participante>> {
    return this.http.post<ApiResponse<Participante>>(`${this.base}/vm/proyectos/${proyectoId}/participantes`, payload);
  }
  obtenerParticipantes(proyectoId: Id): Observable<ApiResponse<Participante[]>> {
    return this.http.get<ApiResponse<Participante[]>>(`${this.base}/vm/proyectos/${proyectoId}/participantes`);
  }
  actualizarParticipante(proyectoId: Id, participanteId: Id, payload: Partial<ParticipanteCreate>): Observable<ApiResponse<Participante>> {
    return this.http.put<ApiResponse<Participante>>(`${this.base}/vm/proyectos/${proyectoId}/participantes/${participanteId}`, payload);
  }
  eliminarParticipante(proyectoId: Id, participanteId: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/proyectos/${proyectoId}/participantes/${participanteId}`);
  }

  // ---------- Reportes de inscripción ----------
  listarInscritosProyecto(
    proyectoId: Id,
    params?: { estado?: 'TODOS' | 'ACTIVOS' | 'FINALIZADOS'; roles?: string[] }
  ): Observable<ApiResponse<InscritosResponseData>> {
    let p = new HttpParams();
    if (params?.estado) p = p.set('estado', params.estado);
    if (params?.roles?.length) params.roles.forEach(r => (p = p.append('roles[]', r)));
    return this.http.get<ApiResponse<InscritosResponseData>>(
      `${this.base}/vm/proyectos/${proyectoId}/inscritos`,
      { params: p }
    );
  }

  listarCandidatosProyecto(
    proyectoId: Id,
    params?: { solo_elegibles?: boolean; q?: string; limit?: number }
  ): Observable<ApiResponse<CandidatosResponseData>> {
    let p = new HttpParams();
    if (params?.solo_elegibles !== undefined) p = p.set('solo_elegibles', String(params.solo_elegibles));
    if (params?.q) p = p.set('q', params.q);
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<ApiResponse<CandidatosResponseData>>(
      `${this.base}/vm/proyectos/${proyectoId}/candidatos`,
      { params: p }
    );
  }

  // ---------- Registros (demo) ----------
  crearRegistro(sesionId: Id, payload: RegistroCreate): Observable<ApiResponse<Registro>> {
    return this.http.post<ApiResponse<Registro>>(`${this.base}/vm/sesiones/${sesionId}/registros`, payload);
  }
  obtenerRegistros(sesionId: Id): Observable<ApiResponse<Registro[]>> {
    return this.http.get<ApiResponse<Registro[]>>(`${this.base}/vm/sesiones/${sesionId}/registros`);
  }
  actualizarRegistro(sesionId: Id, registroId: Id, payload: Partial<RegistroCreate>): Observable<ApiResponse<Registro>> {
    return this.http.put<ApiResponse<Registro>>(`${this.base}/vm/sesiones/${sesionId}/registros/${registroId}`, payload);
  }
  eliminarRegistro(sesionId: Id, registroId: Id): Observable<void> {
    return this.http.delete<void>(`${this.base}/vm/sesiones/${sesionId}/registros/${registroId}`);
  }

  // ---------- Alumno ----------
  listarProyectosAlumno(params?: { periodo_id?: Id; }): Observable<ApiResponse<ProyectosAlumnoData>> {
    let p = new HttpParams();
    if (params?.periodo_id) p = p.set('periodo_id', String(params.periodo_id));
    return this.http.get<ApiResponse<ProyectosAlumnoData>>(`${this.base}/vm/proyectos/alumno`, { params: p });
  }
  inscribirseProyecto(id: Id): Observable<EnrolResponse> {
    return this.http.post<EnrolResponse>(`${this.base}/vm/proyectos/${id}/inscribirse`, {});
  }

  // ---------- Asistencias ----------
  abrirVentanaQr(sesionId: Id, params?: { lat?: number; lng?: number; radio_m?: number; max_usos?: number }): Observable<ApiResponse<VmQrVentanaQR>> {
    return this.http.post<ApiResponse<VmQrVentanaQR>>(`${this.base}/vm/sesiones/${sesionId}/qr`, params ?? {});
  }
  activarVentanaManual(sesionId: Id): Observable<ApiResponse<VmVentanaManual>> {
    return this.http.post<ApiResponse<VmVentanaManual>>(`${this.base}/vm/sesiones/${sesionId}/activar-manual`, {});
  }
  checkInQr(sesionId: Id, payload: { token: string; lat?: number; lng?: number }): Observable<ApiResponse<{ asistencia: any; ventana_fin: string }>> {
    return this.http.post<ApiResponse<{ asistencia: any; ventana_fin: string }>>(`${this.base}/vm/sesiones/${sesionId}/check-in/qr`, payload);
  }
  /** Mantengo este método tal cual lo tenías (compatibilidad) */
  checkInManual(sesionId: Id, payload: { identificador: string }): Observable<ApiResponse<{ asistencia: any }>> {
    return this.http.post<ApiResponse<{ asistencia: any }>>(`${this.base}/vm/sesiones/${sesionId}/check-in/manual`, payload);
  }

  /** 👇 NUEVO: check-in MANUAL por CÓDIGO (usa { codigo } en el body) */
  checkInManualPorCodigo(
    sesionId: Id,
    codigo: string
  ): Observable<ApiResponse<{ asistencia: VmAsistencia }>> {
    return this.http.post<ApiResponse<{ asistencia: VmAsistencia }>>(
      `${this.base}/vm/sesiones/${sesionId}/check-in/manual`,
      { codigo }
    );
  }

  /** Listado normal (útil fuera del poll) */
  listarAsistenciasSesion(sesionId: Id): Observable<ApiResponse<ListadoAsistenciaRow[]>> {
    return this.http.get<ApiResponse<ListadoAsistenciaRow[]>>(`${this.base}/vm/sesiones/${sesionId}/asistencias`);
  }

  /** 👇 NUEVO: Listar PARTICIPANTES de la sesión con estado_calculado */
  listarParticipantesSesion(
    sesionId: Id
  ): Observable<ApiResponse<ParticipantesResponse>> {
    return this.http.get<ApiResponse<ParticipantesResponse>>(
      `${this.base}/vm/sesiones/${sesionId}/participantes`
    );
  }

  /** 👇 NUEVO: Registrar ASISTENCIA FUERA DE HORA (justificada) */
  checkInFueraDeHora(
    sesionId: Id,
    payload: JustificarAsistenciaPayload
  ): Observable<ApiResponse<JustificarAsistenciaResponse>> {
    return this.http.post<ApiResponse<JustificarAsistenciaResponse>>(
      `${this.base}/vm/sesiones/${sesionId}/asistencias/justificar`,
      payload
    );
  }

  /** 👇 NUEVO: Poll condicional con ETag/If-None-Match para evitar re-render si no hubo cambios */
  listarAsistenciasSesionPoll(
    sesionId: Id,
    etag?: string
  ): Observable<PollResult<ReadonlyArray<ListadoAsistenciaRow>>> {
    let headers = new HttpHeaders();
    if (etag) headers = headers.set('If-None-Match', etag);

    return this.http
      .get<ApiResponse<ReadonlyArray<ListadoAsistenciaRow>>>(
        `${this.base}/vm/sesiones/${sesionId}/asistencias`,
        { observe: 'response', headers }
      )
      .pipe(
        map(
          (resp: HttpResponse<ApiResponse<ReadonlyArray<ListadoAsistenciaRow>>>):
            PollResult<ReadonlyArray<ListadoAsistenciaRow>> => {
            const body = resp.body;
            const data =
              body && (body as any).ok === true
                ? ((body as any).data ?? [])
                : ([] as ReadonlyArray<ListadoAsistenciaRow>);

            return {
              ok: true as const,
              notModified: false as const,
              data,
              etag: resp.headers.get('ETag') ?? undefined,
              lastModified: resp.headers.get('Last-Modified') ?? undefined,
            };
          }
        ),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 304) {
            // No cambió nada → no tocar UI
            return of<PollResult<ReadonlyArray<ListadoAsistenciaRow>>>({
              ok: true as const,
              notModified: true as const,
              etag,
              lastModified: err.headers?.get?.('Last-Modified') ?? undefined,
            });
          }
          return throwError(() => err);
        })
      );
  }

  descargarReporteAsistenciasCSV(sesionId: Id): Observable<Blob> {
    return this.http.get(`${this.base}/vm/sesiones/${sesionId}/asistencias/reporte?format=csv`, { responseType: 'blob' });
  }
  validarAsistenciasSesion(sesionId: Id, payload?: { asistencias?: Id[]; crear_registro_horas?: boolean }): Observable<ApiResponse<ValidarAsistenciasResp>> {
    return this.http.post<ApiResponse<ValidarAsistenciasResp>>(`${this.base}/vm/sesiones/${sesionId}/validar`, payload ?? {});
  }

  // ---------- Agenda ----------
  obtenerAgendaAlumno(params?: { periodo_id?: Id; }): Observable<ApiResponse<AlumnoAgendaResponse>> {
    let p = new HttpParams(); if (params?.periodo_id) p = p.set('periodo_id', String(params.periodo_id));
    return this.http.get<ApiResponse<AlumnoAgendaResponse>>(`${this.base}/vm/alumno/agenda`, { params: p });
  }
  obtenerAgendaStaff(params?: { periodo_id?: Id; nivel?: number; }): Observable<ApiResponse<StaffAgendaResponse>> {
    let p = new HttpParams();
    if (params?.periodo_id) p = p.set('periodo_id', String(params.periodo_id));
    if (params?.nivel !== undefined) p = p.set('nivel', String(params.nivel));
    return this.http.get<ApiResponse<StaffAgendaResponse>>(`${this.base}/vm/staff/agenda`, { params: p });
  }

  // ---------- NUEVO: /vm/sesiones (Proyecto + Proceso + Sesiones agrupadas) ----------
  listarSesiones(params?: {
    periodo_id?: Id;
    nivel?: number;
    proyecto_id?: Id;
    proceso_id?: Id;
    desde?: string;   // YYYY-MM-DD
    hasta?: string;   // YYYY-MM-DD
  }): Observable<ApiResponse<SesionesListResponse>> {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      });
    }
    return this.http.get<ApiResponse<SesionesListResponse>>(`${this.base}/vm/sesiones`, { params: p });
  }

  listarProyectosExpand(
    params?: {
      q?: string;
      page?: number;
      ep_sede_id?: Id;
      periodo_id?: Id;
      estado?: string;
      nivel?: number;
      tipo?: 'LIBRE' | 'VINCULADO';
    },
    expand?: 'arbol' | 'procesos' | 'sesiones' | 'procesos,sesiones' | string,
    withTree?: boolean
  ): Observable<ApiResponse<ProyectoIndexPage>> {
    let p = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    if (expand && expand.trim()) p = p.set('expand', expand);
    if (withTree) p = p.set('with_tree', '1');

    return this.http.get<ApiResponse<ProyectoIndexPage>>(`${this.base}/vm/proyectos`, { params: p });
  }

  /** Atajo: pide el index en formato árbol (mismo shape que /vm/proyectos/{id}) */
  listarProyectosArbol(
    params?: {
      q?: string;
      page?: number;
      ep_sede_id?: Id;
      periodo_id?: Id;
      estado?: string;
      nivel?: number;
      tipo?: 'LIBRE' | 'VINCULADO';
    }
  ): Observable<ApiResponse<ProyectoIndexPage>> {
    // expand=arbol ya incluye procesos y sesiones ordenadas (según tu backend)
    return this.listarProyectosExpand(params, 'arbol', true);
  }

  // ---------- NUEVO: Proyecto (contexto edición) ----------
obtenerProyectoContextoEdicion(id: Id): Observable<ApiResponse<VmProyectoArbol>> {
  // GET /vm/proyectos/{proyecto}/edit  → retorna { proyecto, procesos }
  return this.http.get<ApiResponse<VmProyectoArbol>>(
    `${this.base}/vm/proyectos/${id}/edit`
  );
}

// ---------- NUEVO: Proceso (contexto edición + update/delete por ID) ----------
obtenerProcesoContextoEdicion(procesoId: Id): Observable<ApiResponse<{ proceso: VmProceso; sesiones: VmSesion[] }>> {
  // GET /vm/procesos/{proceso}/edit → { proceso, sesiones }
  return this.http.get<ApiResponse<{ proceso: VmProceso; sesiones: VmSesion[] }>>(
    `${this.base}/vm/procesos/${procesoId}/edit`
  );
}

actualizarProcesoById(procesoId: Id, payload: Partial<ProcesoCreate>): Observable<ApiResponse<VmProceso>> {
  // PUT /vm/procesos/{proceso}
  return this.http.put<ApiResponse<VmProceso>>(
    `${this.base}/vm/procesos/${procesoId}`,
    payload
  );
}

eliminarProcesoById(procesoId: Id): Observable<void> {
  // DELETE /vm/procesos/{proceso}
  return this.http.delete<void>(`${this.base}/vm/procesos/${procesoId}`);
}

// ---------- NUEVO: Sesión (editar por ID) ----------
obtenerSesionParaEdicion(sesionId: Id): Observable<ApiResponse<VmSesion>> {
  // GET /vm/sesiones/{sesion}/edit
  return this.http.get<ApiResponse<VmSesion>>(
    `${this.base}/vm/sesiones/${sesionId}/edit`
  );
}

actualizarSesionById(sesionId: Id, payload: Partial<SesionCreate>): Observable<ApiResponse<VmSesion>> {
  // PUT /vm/sesiones/{sesion}
  return this.http.put<ApiResponse<VmSesion>>(
    `${this.base}/vm/sesiones/${sesionId}`,
    payload
  );
}

eliminarSesionById(sesionId: Id): Observable<void> {
  // DELETE /vm/sesiones/{sesion}
  return this.http.delete<void>(`${this.base}/vm/sesiones/${sesionId}`);
}

}
