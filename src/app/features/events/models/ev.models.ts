// ─────────────────────────────────────────────────────────────
// Eventos (ya existentes)
export interface VmEvento {
  id: number;
  codigo: string;
  titulo: string;
  periodo_id: number;
  targetable_type: 'ep_sede' | 'sede' | 'facultad';
  targetable_id: number;
  fecha: string;       // YYYY-MM-DD
  hora_inicio: string; // HH:mm
  hora_fin: string;    // HH:mm
  requiere_inscripcion: boolean;
  cupo_maximo?: number | null;
  estado: 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | 'CANCELADO';
  created_at?: string;
}

// Filtros para listar eventos
export interface EventoFilter {
  estado?: string;
  target_id?: number;
  search?: string;
  page?: number;
}

// Imágenes (si usas ImagenResource)
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
// Periodos (NUEVO)
// ─────────────────────────────────────────────────────────────

export type PeriodoEstado = 'PLANIFICADO' | 'EN_CURSO' | 'CERRADO' | string;

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
 * Si necesitas fechas en la UI, puedes añadirlas opcionalmente.
 */
export interface Periodo {
  id: number;
  anio: number;
  ciclo: string;
  estado?: PeriodoEstado;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export type EventoCreate = {
  titulo: string;
  periodo_id: number;
  target_type: 'ep_sede' | 'sede' | 'facultad';
  target_id: number;
  fecha: string;       // YYYY-MM-DD
  hora_inicio: string; // HH:mm
  hora_fin: string;    // HH:mm
  requiere_inscripcion?: boolean;
  cupo_maximo?: number | null;
};
