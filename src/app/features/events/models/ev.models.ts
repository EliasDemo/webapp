// ─────────────────────────────────────────────────────────────
// Periodos
// ─────────────────────────────────────────────────────────────

export type PeriodoEstado =
  | 'PLANIFICADO'
  | 'EN_CURSO'
  | 'CERRADO'
  | string;

export interface PeriodoRaw {
  id: number;
  anio: number;
  ciclo: string | number;
  estado?: PeriodoEstado;
  fecha_inicio?: string;
  fecha_fin?: string;
}

/**
 * Periodo normalizado para UI (ciclo siempre string).
 */
export interface Periodo {
  id: number;
  anio: number;
  ciclo: string;
  estado?: PeriodoEstado;
  fecha_inicio?: string;
  fecha_fin?: string;
}

// ─────────────────────────────────────────────────────────────
// Eventos
// ─────────────────────────────────────────────────────────────

export type TargetType = 'ep_sede' | 'sede' | 'facultad';

export type VmEstado = 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | 'CANCELADO';

export interface VmCategoriaEvento {
  id: number;
  nombre: string;
  descripcion?: string | null;
}

export interface VmSesion {
  id: number;
  fecha: string;       // YYYY-MM-DD
  hora_inicio: string; // HH:mm[:ss]
  hora_fin: string;    // HH:mm[:ss]
  estado: VmEstado;
  duracion_minutos?: number | null;
  niveles?: number[];
}

export interface SesionCreate {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado?: VmEstado;
}

export interface VmEvento {
  id: number;
  codigo: string;
  titulo: string;
  subtitulo?: string | null;

  descripcion_corta?: string | null;
  descripcion_larga?: string | null;

  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
  lugar_detallado?: string | null;
  url_imagen_portada?: string | null;
  url_enlace_virtual?: string | null;

  periodo_id: number;
  periodo?: Periodo | null;

  categoria_evento_id?: number | null;
  categoria?: VmCategoriaEvento | null;

  // Backend: 'ep_sede' para este módulo
  targetable_type: TargetType;
  targetable_id: number;
  ep_sede_id?: number | null;

  requiere_inscripcion: boolean;
  cupo_maximo?: number | null;

  inscripcion_desde?: string | null;
  inscripcion_hasta?: string | null;

  estado: VmEstado;

  sesiones?: VmSesion[];

  created_at?: string;
  updated_at?: string;
}

// Filtros para listar eventos
export interface EventoFilter {
  estado?: string;
  target_id?: number;
  categoria_evento_id?: number;
  search?: string;
  page?: number;
  solo_mi_ep_sede?: boolean | number | string;
}

/**
 * Payload para crear evento (sin target; backend lo resuelve por usuario).
 */
export interface EventoCreate {
  titulo: string;
  periodo_id: number;

  categoria_evento_id?: number | null;

  codigo?: string | null;
  subtitulo?: string | null;
  descripcion_corta?: string | null;
  descripcion_larga?: string | null;

  modalidad?: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
  lugar_detallado?: string | null;
  url_imagen_portada?: string | null;
  url_enlace_virtual?: string | null;

  requiere_inscripcion?: boolean;
  cupo_maximo?: number | null;

  inscripcion_desde?: string | null;
  inscripcion_hasta?: string | null;

  sesiones: SesionCreate[];
}

// ─────────────────────────────────────────────────────────────
// Imágenes
// ─────────────────────────────────────────────────────────────

export interface VmImagen {
  id: number;
  imageable_id: number;
  imageable_type: 'App\\Models\\VmEvento' | string;

  url?: string | null;
  url_publica?: string | null;

  titulo?: string | null;
  visibilidad: 'PUBLICA' | 'PRIVADA';

  disk?: string | null;
  path?: string | null;

  subido_por?: number | null;

  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Usuario / Expediente ref para eventos
// ─────────────────────────────────────────────────────────────

export interface VmUsuarioRef {
  id: number | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  celular?: string | null;
}

export interface VmExpedienteRef {
  id: number;
  codigo?: string | null;
  grupo?: string | null;
  ciclo?: string | null;
  usuario?: VmUsuarioRef | null;
}

// Resumen de evento que se usa en inscritos/candidatos
export interface VmEventoResumen {
  id: number;
  estado?: VmEstado;
  requiere_inscripcion?: boolean;
  cupo_maximo?: number | null;
}

// ─────────────────────────────────────────────────────────────
// Inscritos en evento
// ─────────────────────────────────────────────────────────────

export interface VmEventoInscritoItem {
  participacion_id: number;
  rol: string;
  estado: string;
  expediente: VmExpedienteRef;
}

export interface VmEventoInscritosResumen {
  total: number;
  activos: number;
  finalizados: number;
}

export interface VmEventoInscritosData {
  evento: VmEventoResumen;
  resumen: VmEventoInscritosResumen;
  inscritos: VmEventoInscritoItem[];
}

export type VmEventoInscritosEstadoFiltro =
  | 'TODOS'
  | 'ACTIVOS'
  | 'FINALIZADOS';

export interface VmEventoInscritosFilter {
  estado?: VmEventoInscritosEstadoFiltro;
  roles?: string[];
}

// ─────────────────────────────────────────────────────────────
// Candidatos a evento
// ─────────────────────────────────────────────────────────────

export interface VmEventoCandidatoItem {
  expediente_id: number;
  codigo?: string | null;
  grupo?: string | null;
  ciclo?: string | null;
  usuario: VmUsuarioRef | null;
  motivo: string; // 'ELEGIBLE_EVENTO'
}

export interface VmEventoNoElegibleItem {
  expediente_id: number;
  codigo?: string | null;
  razon: string; // 'ALREADY_ENROLLED', 'EVENT_NOT_ACTIVE', etc.
  meta?: any;
}

export interface VmEventoCandidatosData {
  evento: VmEventoResumen;
  candidatos_total: number;
  descartados_total: number;
  candidatos: VmEventoCandidatoItem[];
  no_elegibles: VmEventoNoElegibleItem[];
}

export interface VmEventoCandidatosFilter {
  q?: string;
  solo_elegibles?: boolean;
  limit?: number;
}


// ─────────────────────────────────────────────────────────────
// Mis eventos (vista alumno)
// ─────────────────────────────────────────────────────────────

export type VmMisEventosEstadoParticipacion =
  | 'TODOS'
  | 'ACTIVOS'
  | 'FINALIZADOS';

export interface VmMisEventosFilter {
  periodo_id?: number;
  estado_participacion?: VmMisEventosEstadoParticipacion;
}

export interface VmEventoParticipacionRef {
  id: number;
  estado: string;
}

export interface VmMisEventosPeriodo extends Periodo {
  total_eventos: number;
}

export interface VmEventoAlumnoItem {
  id: number;
  codigo: string;
  titulo: string;
  subtitulo?: string | null;

  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
  estado: VmEstado;

  periodo_id: number;
  requiere_inscripcion: boolean;
  cupo_maximo?: number | null;

  periodo: Periodo;
  participacion: VmEventoParticipacionRef;
}

export interface VmMisEventosData {
  periodos: VmMisEventosPeriodo[];
  eventos: VmEventoAlumnoItem[];
}
