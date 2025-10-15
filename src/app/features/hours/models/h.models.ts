// h.models.ts

export type Id = number;

/** Parámetros aceptados por /reportes/horas/... */
export type HorasQuery = Partial<{
  periodo_id: Id;
  desde: string;             // YYYY-MM-DD
  hasta: string;             // YYYY-MM-DD
  estado: string;            // default 'APROBADO', usa '*' para todos
  tipo: string;              // vinculable_type (p.ej. 'vm_proyecto' | 'vm_evento')
  vinculable_id: Id;
  q: string;
  per_page: number;          // default 15
  page: number;
}>;

/** Periodo resumido */
export interface PeriodoRef {
  id: Id;
  codigo?: string | null;
}

/** Vinculable cuando es PROYECTO */
export interface VinculableProyectoRef {
  tipo: 'vm_proyecto';
  id: number;
  codigo: string | null;
  titulo: string | null;
  descripcion: string | null;
  tipo_proyecto: 'LIBRE' | 'VINCULADO' | null;
  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA' | null;
  estado: 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | 'CANCELADO' | string | null;
  horas_planificadas: number | null;
}

/** Vinculable cuando es EVENTO (ajusta si tienes más campos) */
export interface VinculableEventoRef {
  tipo: 'vm_evento';
  id: Id;
  codigo: string | null;
  titulo: string | null;
  estado: string | null;
}

/** Fallback para otros morphs */
export interface VinculableGenericRef {
  tipo: string;
  id: Id | null;
  codigo?: string | null;
  titulo?: string | null;
  estado?: string | null;
}

export type VinculableRef =
  | VinculableProyectoRef
  | VinculableEventoRef
  | VinculableGenericRef;

/** Item del historial */
export interface RegistroHoraItem {
  id: Id;
  fecha: string;           // YYYY-MM-DD
  minutos: number;
  horas: number;
  actividad: string | null;
  estado: string;

  periodo?: PeriodoRef | null;
  vinculable?: VinculableRef | null;

  sesion_id: Id | null;
  asistencia_id: Id | null;

  [extra: string]: any;
}

/** Resumen */
export interface ResumenPorPeriodoItem {
  periodo_id: Id | null;
  codigo?: string | null;
  minutos: number;
  horas: number;
}

export interface ResumenPorVinculoItem {
  tipo: string;
  id: Id;
  titulo: string | null;
  minutos: number;
  horas: number;
}

export interface ResumenHoras {
  total_minutos: number;
  total_horas: number;
  por_periodo: ResumenPorPeriodoItem[];
  por_vinculo: ResumenPorVinculoItem[];
}

/** Data del endpoint */
export interface ReporteHorasData {
  resumen: ResumenHoras;
  historial: RegistroHoraItem[];
}

export interface PaginacionMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** Respuesta */
export type ReporteHorasOk = {
  ok: true;
  data: ReporteHorasData;
  meta: PaginacionMeta;
};

export type ReporteHorasFail = {
  ok: false;
  code?: string;
  message: string;
  meta?: Record<string, unknown>;
};

export type ReporteHorasResponse = ReporteHorasOk | ReporteHorasFail;
