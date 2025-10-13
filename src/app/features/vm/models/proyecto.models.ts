// Tipos base
export type Id = number;

export type TipoProyecto = 'VINCULADO' | 'LIBRE';
export type Modalidad = 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
export type TipoRegistro = 'HORAS' | 'ASISTENCIA' | 'EVALUACION' | 'MIXTO';

export type ApiOk<T>  = { ok: true;  data: T };
export type ApiFail   = { ok: false; code?: string; message: string; meta?: Record<string, unknown> };
export type ApiResponse<T> = ApiOk<T> | ApiFail;

export function isApiOk<T>(r: ApiResponse<T>): r is ApiOk<T> {
  return (r as ApiOk<T>).ok === true;
}

/** 👇 NUEVO: resultado para polls con ETag/304 */
export type PollResult<T> = {
  ok: true;
  notModified: boolean;   // true si el backend respondió 304
  data?: T;               // sólo presente cuando hay 200
  etag?: string;          // ETag devuelto por el backend
  lastModified?: string;  // opcional
};

// Recursos
export interface VmProyecto {
  id: Id;
  codigo: string | null;
  titulo: string;
  tipo: TipoProyecto;
  modalidad: Modalidad;
  estado: 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | string;
  nivel: number | null;
  descripcion?: string | null;
  ep_sede_id: Id;
  periodo_id: Id;
  horas_planificadas: number;
  horas_minimas_participante: number | null;
  created_at: string | null;
  cover_url?: string | null;
  imagenes?: { url: string | null }[];
  imagenes_total?: number;
}

export interface VmProceso {
  id: Id;
  proyecto_id: Id;
  nombre: string;
  descripcion: string | null;
  tipo_registro: TipoRegistro;
  horas_asignadas: number | null;
  nota_minima: number | null;
  requiere_asistencia: boolean;
  orden: number | null;
  estado: string;
  created_at: string | null;
}

export interface VmSesion {
  id: Id;
  sessionable_type: string;
  sessionable_id: Id;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  created_at: string | null;
}

export type TargetType = 'ep_sede' | 'sede' | 'facultad';
export interface VmEvento {
  id: Id;
  periodo_id: Id;
  target_type: TargetType;
  target_id: Id;
  codigo: string | null;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  requiere_inscripcion: boolean;
  cupo_maximo: number | null;
  estado: string;
  created_at: string | null;
}

export interface Imagen { id: Id; url: string | null; created_at?: string | null; }

// Payloads
export interface ProyectoCreate {
  ep_sede_id: Id;
  periodo_id: Id;
  codigo?: string | null;
  titulo: string;
  descripcion?: string | null;
  tipo: TipoProyecto;
  modalidad: Modalidad;
  nivel: number | null;
  horas_planificadas: number;
  horas_minimas_participante?: number | null;
}

export interface ProcesoCreate {
  nombre: string;
  descripcion?: string | null;
  tipo_registro: TipoRegistro;
  horas_asignadas?: number | null;
  nota_minima?: number | null;
  requiere_asistencia?: boolean;
  orden?: number | null;
}

export interface SesionCreate { fecha: string; hora_inicio: string; hora_fin: string; }

export type SesionesBatchCreate =
  | { mode: 'range'; fecha_inicio: string; fecha_fin: string; dias_semana?: Array<'DO'|'LU'|'MA'|'MI'|'JU'|'VI'|'SA'|0|1|2|3|4|5|6>; hora_inicio: string; hora_fin: string; }
  | { mode: 'list'; fechas: string[]; hora_inicio: string; hora_fin: string; };

export interface EventoCreate {
  periodo_id: Id; target_type: TargetType; target_id: Id;
  codigo?: string | null; titulo: string; fecha: string; hora_inicio: string; hora_fin: string;
  requiere_inscripcion?: boolean; cupo_maximo?: number | null;
}

// Árbol
export type VmProcesoConSesiones = VmProceso & { sesiones?: VmSesion[] };
export interface VmProyectoArbol { proyecto: VmProyecto; procesos: VmProcesoConSesiones[]; }

// Alumno + inscripción
export interface ProyectosAlumnoContexto {
  ep_sede_id: Id; periodo_id: Id; periodo_codigo: string | number; nivel_objetivo: number; tiene_pendiente_vinculado: boolean;
}

export interface ProyectosAlumnoPendiente {
  proyecto: VmProyecto; periodo: string | number;
  requerido_min: number; acumulado_min: number; faltan_min: number; cerrado: boolean;
}

export interface ProyectosAlumnoData {
  contexto: ProyectosAlumnoContexto;
  pendientes: ProyectosAlumnoPendiente[];
  inscribibles_prioridad: VmProyecto[];
  libres: VmProyecto[];
  faltantes_informativos: VmProyecto[];
}

export interface VmParticipacion {
  id: Id; participable_type: string; participable_id: Id; expediente_id: Id; rol: string;
  estado: 'INSCRITO'|'CONFIRMADO'|'RETIRADO'|'CANCELADO'|'FINALIZADO'|string; created_at: string | null;
}

export type EnrolOk = { ok: true; code: 'ENROLLED'; data: { participacion: VmParticipacion; proyecto: { id: Id; tipo: TipoProyecto; nivel: number | null } } };
export type EnrolFailCode = 'PROJECT_NOT_ACTIVE' | 'DIFFERENT_EP_SEDE' | 'ALREADY_ENROLLED' | 'PENDING_LINKED_PREV' | 'LEVEL_NOT_ALLOWED' | 'LEVEL_ALREADY_COMPLETED';
export type EnrolFail = ApiFail & { code: EnrolFailCode };
export type EnrolResponse = EnrolOk | EnrolFail;

// Asistencias
export type MetodoAsistencia =
  | 'QR'
  | 'MANUAL'
  | 'MANUAL_JUSTIFICADA'   // 👈 NUEVO (fuera de hora con justificación)
  | 'IMPORTADO'
  | 'AJUSTE';

export type EstadoAsistencia  = 'PENDIENTE' | 'VALIDADO' | 'ANULADO' | string;

export interface VmAsistencia {
  id: Id; sesion_id: Id; expediente_id: Id; participacion_id: Id | null; qr_token_id: Id | null;
  metodo: MetodoAsistencia; check_in_at: string | null; check_out_at: string | null; estado: EstadoAsistencia;
  minutos_validados: number; meta?: Record<string, unknown> | null; created_at: string | null;
}

export interface VmQrVentanaQR { token: string; usable_from: string; expires_at: string; geo?: { lat: number; lng: number; radio_m: number } | null; }
export interface VmVentanaManual { usable_from: string; expires_at: string; }

export interface ListadoAsistenciaRow {
  id: Id; metodo: MetodoAsistencia; estado: EstadoAsistencia; check_in_at: string | null; minutos: number;
  codigo: string | null; dni: string | null; nombres: string | null; apellidos: string | null;
}

export interface ValidarAsistenciasResp { validadas: number; minutos_por_asistencia: number; registro_horas_creado: boolean; }

// Agenda
export type AlumnoSesionEstado = 'PROXIMA' | 'ACTUAL' | 'PASADA';
export type AlumnoAsistenciaEstado = 'PENDIENTE' | 'VALIDADO' | 'ANULADO' | 'SIN_REGISTRO';

export interface AlumnoSesion {
  sesion: VmSesion;
  estado_relativo: AlumnoSesionEstado;
  asistencia: { estado: AlumnoAsistenciaEstado; metodo?: MetodoAsistencia | null; check_in_at?: string | null } | null;
}

export interface AlumnoProcesoResumen {
  proceso: VmProceso;
  progreso: { min_total: number; min_validados: number; min_pendientes: number; sesiones_total: number; sesiones_asistidas: number; sesiones_faltadas: number; };
  sesiones: AlumnoSesion[];
}

export interface AlumnoProyectoAgenda { proyecto: VmProyecto; procesos: AlumnoProcesoResumen[]; }
export type AlumnoAgendaResponse = AlumnoProyectoAgenda[];

export interface StaffSesionCard {
  sesion: VmSesion; proyecto: VmProyecto; proceso: VmProceso;
  inscritos: number; asistencias: number; ventanas?: { qr?: VmQrVentanaQR | null; manual?: VmVentanaManual | null } | null;
}
export type StaffAgendaResponse = StaffSesionCard[];

// Paginación
export interface Page<T> { data: T[]; current_page: number; last_page: number; total: number; }

// Participantes y registros
export interface Participante {
  id: Id; usuario_id: Id; proyecto_id: Id; rol: string; horas_asignadas: number | null; estado: string; created_at: string | null;
  usuario?: { id: Id; nombre: string; email: string; avatar_url?: string | null; };
}
export interface ParticipanteCreate { usuario_id: Id; rol?: string; horas_asignadas?: number | null; }

export interface Registro {
  id: Id; sesion_id: Id; usuario_id: Id; tipo: TipoRegistro; horas: number | null; asistio: boolean | null; calificacion: number | null; observaciones: string | null; created_at: string | null;
}
export interface RegistroCreate { usuario_id: Id; tipo: TipoRegistro; horas?: number | null; asistio?: boolean | null; calificacion?: number | null; observaciones?: string | null; }

// Reportes de inscripción
export interface VmProyectoResumen {
  id: number;
  tipo: 'LIBRE' | 'VINCULADO' | string;
  nivel: number;
}

export interface UsuarioRef {
  id: number | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  celular?: string | null;
}

export interface ExpedienteRef {
  id: number;
  codigo?: string | null;
  grupo?: string | null;
  usuario?: UsuarioRef;
}

export interface InscritoItem {
  participacion_id: number;
  rol: string;
  estado: string;
  expediente: ExpedienteRef;
  requerido_min: number;
  acumulado_min: number;
  faltan_min: number;
  porcentaje: number | null;
  finalizado: boolean;
}
export interface InscritosResponseData {
  proyecto: VmProyectoResumen;
  resumen: { total: number; activos: number; finalizados: number };
  inscritos: InscritoItem[];
}

export type MotivoElegible = 'ELEGIBLE_LIBRE' | 'ELEGIBLE_VINCULADO';
export type RazonNoElegible =
  | 'ALREADY_ENROLLED'
  | 'PROJECT_NOT_ACTIVE'
  | 'PENDING_LINKED_PREV'
  | 'LEVEL_NOT_ALLOWED'
  | 'LEVEL_ALREADY_COMPLETED';

export interface CandidatoItem {
  expediente_id: number;
  codigo?: string | null;
  usuario?: UsuarioRef;
  motivo: MotivoElegible;
}

export interface NoElegibleItem {
  expediente_id: number;
  codigo?: string | null;
  razon: RazonNoElegible | string;
  meta?: any;
}

export interface CandidatosResponseData {
  proyecto: VmProyectoResumen;
  candidatos_total: number;
  descartados_total: number;
  candidatos: CandidatoItem[];
  no_elegibles: NoElegibleItem[];
}

export interface ProyectoMin {
  id: Id;
  codigo: string | null;
  titulo: string;
  estado: string;
}

export interface ProcesoMin {
  id: Id;
  proyecto_id: Id;
  nombre: string;
  tipo_registro: TipoRegistro | string;
  estado: string;
}

export interface SesionRow {
  id: Id;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  relativo: 'PROXIMA' | 'ACTUAL' | 'PASADA';
  created_at: string | null;
}

export interface ProcesoSesionesResumen {
  total: number;
  proximas: number;
  actuales: number;
  pasadas: number;
}

export interface ProyectoArbolIndexItem {
  proyecto: VmProyecto;
  procesos: VmProcesoConSesiones[];
}

export type ProyectoIndexPage = Page<VmProyecto | ProyectoArbolIndexItem>;

export interface ProcesoSesionesGroup {
  proyecto: ProyectoMin;
  proceso: ProcesoMin;
  resumen: ProcesoSesionesResumen;
  sesiones: SesionRow[];
}

export type SesionesListResponse = ProcesoSesionesGroup[];

// ───────────────────────────────────────────────────────────────
// 👇 NUEVO: participantes de sesión y justificación fuera de hora
// ───────────────────────────────────────────────────────────────

/** '' = pendiente (dentro de la ventana ±1h), 'FALTA' = fuera de ventana sin asistencia, 'PRESENTE' = tiene asistencia */
export type EstadoCalculado = 'PRESENTE' | 'FALTA' | '';

export interface ParticipanteSesionRow {
  participacion_id: Id;
  expediente_id: Id | null;
  codigo: string | null;
  dni: string | null;
  nombres: string | null;
  apellidos: string | null;
  asistencia: null | {
    id: Id;
    metodo: MetodoAsistencia;
    estado: EstadoAsistencia;
    check_in_at: string | null;
    minutos: number;
  };
  estado_calculado: EstadoCalculado;
}

export type ParticipantesResponse = ParticipanteSesionRow[];

export interface JustificarAsistenciaPayload {
  codigo: string;
  justificacion: string;
  otorgar_horas?: boolean; // default true en backend
}

export interface JustificarAsistenciaResponse {
  asistencia: VmAsistencia;
}
