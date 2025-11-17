// ─────────────────────────────────────────────────────────────
// Reportes: Horas por período (FE types)
// ─────────────────────────────────────────────────────────────

export type RpUnidad = 'h' | 'min';
export type RpEstadoRegistro = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';
export type RpOrdenCampo = 'apellidos' | 'codigo' | 'total';
export type RpDir = 'asc' | 'desc';

/**
 * Filtros que acepta el backend (coinciden con el controller de Laravel).
 * periodos[] usa formato YYYY-1 | YYYY-2 (p.ej. "2025-1").
 */
export interface RpHorasFiltro {
  periodos?: string[];                            // p.ej. ['2025-1','2025-2']
  ultimos?: number;                               // 1..12 (si no envías periodos)
  unidad?: RpUnidad;                              // 'h' | 'min' (default 'h')
  estado?: RpEstadoRegistro;                      // default 'APROBADO'
  solo_con_horas_periodos?: boolean | '0' | '1';  // default '1'
  orden?: RpOrdenCampo;                           // default 'apellidos'
  dir?: RpDir;                                    // default 'asc'
}

/**
 * Meta que retorna el backend.
 */
export interface RpHorasPorPeriodoMeta {
  epSedeId?: number;                    // opcional (camel)
  ep_sede_id?: number;                  // opcional (snake) ← usado por FE
  escuela_profesional?: string;         // opcional (usado por FE)
  periodos?: Array<string | { codigo: string }>;
  ultimos?: number | null;
  unidad?: RpUnidad;
  estado?: RpEstadoRegistro;
  soloConHorasEnSeleccion?: boolean;
  orden?: RpOrdenCampo;
  dir?: RpDir;
  bucket_antes?: string;                // si el backend agrega el bucket "ANTES_DE_*"
  generado_en?: string;                 // ISO string (opcional)
  // Cualquier otro metadato:
  [k: string]: unknown;
}

/**
 * Cada fila del reporte. `periodos` es un diccionario periodo->valor.
 */
export interface RpHorasPorPeriodoItem {
  persona_id?: number;
  codigo?: string;
  apellidos?: string;
  nombres?: string;
  total: number;
  periodos: Record<string, number>; // ej: {'2025-1': 12, '2025-2': 8}
  [k: string]: unknown;
}

export interface RpHorasPorPeriodoPayload {
  meta: RpHorasPorPeriodoMeta;
  data: RpHorasPorPeriodoItem[];
}

/** Envoltorio estándar. */
export type ApiResponse<T> = { ok: boolean; data: T; meta?: any };

// ─────────────────────────────────────────────
// Reporte: avance "mías por proyecto"
//   GET /api/reportes/horas/mias/por-proyecto
// ─────────────────────────────────────────────

export interface RpAvanceProyectoItem {
  id: number;
  titulo: string | null;
  minutos: number;
  horas: number;
  horas_planificadas?: number | null;
  minutos_requeridos?: number | null;
  minutos_faltantes?: number | null;
  porcentaje?: number | null; // 0..100
  [k: string]: unknown;
}

export interface RpAvancePorProyectoData {
  por_proyecto: RpAvanceProyectoItem[];
  total_minutos: number;
  total_horas: number;
}

export interface RpAvanceFiltro {
  estado?: RpEstadoRegistro | '*'; // default 'APROBADO'
  periodo_id?: number;
  debug?: boolean;
}

// ─────────────────────────────────────────────
// Import horas históricas (VM)
// ─────────────────────────────────────────────

export interface VmImportHorasHistoricasOptions {
  ep_sede_id?: number; // opcional, el backend lo puede resolver
  replace?: boolean;   // si true, borra lo previo en las sesiones afectadas
}

export interface VmImportHorasHistoricasError {
  row?: number;
  codigo?: string;
  reason?: string;
  [k: string]: unknown;
}

export interface VmImportHorasHistoricasSummary {
  processed_rows: number;
  targets: number;
  asistencias_upserted: number;
  errors: number;
}

export interface VmImportHorasHistoricasResponse {
  ok: boolean;
  summary?: VmImportHorasHistoricasSummary;
  errors?: VmImportHorasHistoricasError[] | any;
}

/** Status simple: ¿hay horas históricas cargadas? */
export interface VmImportHorasHistoricasStatus {
  ok: boolean;
  ep_sede_id: number;
  has_horas: boolean;
}

/** Opciones para descargar plantilla (periodos o ultimos N). */
export interface VmPlantillaHorasOptions {
  periodos?: string[];
  ultimos?: number;
}
