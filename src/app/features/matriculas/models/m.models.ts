// src/app/features/matriculas/models/m.models.ts
export type Id = number;

/** Resumen que devuelve el importador (backend) */
export interface MatriculaImportSummary {
  processed: number;
  created_users: number;
  updated_users: number;
  created_expedientes: number;
  updated_expedientes: number;
  created_matriculas: number;
  updated_matriculas: number;
  skipped: number;
  errors: number;
}

/** IDs creados/actualizados por fila */
export interface MatriculaImportRowIds {
  user_id: Id | null | undefined;
  expediente_id: Id | null | undefined;
  matricula_id: Id | null | undefined;
}

/** Datos “visibles” por fila (los más importantes) */
export interface MatriculaImportRowData {
  usuario?: string | null;
  email?: string | null;
  estudiante?: string | null;
  documento?: string | null;
  correo_institucional?: string | null;
  codigo_estudiante?: string | null;
  ciclo?: string | null;
  grupo?: string | null;
  modalidad_estudio?: string | null;
  modo_contrato?: string | null;
  fecha_matricula?: string | null;      // normalizada (Y-m-d)
  fecha_matricula_raw?: string | null;  // tal como vino
  pais?: string | null;
  pais_iso2?: string | null;
}

/** Fila procesada por el importador */
export interface MatriculaImportRow {
  row: number;                                        // número de fila (Excel)
  status: 'ok' | 'error';
  message: string;
  ids: MatriculaImportRowIds | null;
  data: MatriculaImportRowData | null;
}

/** Errores por campo del validador */
export type FieldErrors = Record<string, string[]>;

/** Respuesta OK del importador */
export type MatriculaImportOk = {
  ok: true;
  summary: MatriculaImportSummary;
  rows: MatriculaImportRow[];
};

/** Respuesta con error del importador (formas posibles del backend) */
export type MatriculaImportFail = {
  ok: false;
  message?: string;
  errors?: FieldErrors;     // errores por campo (422)
  error?: string;           // mensaje técnico opcional
  choices?: Id[];           // EP-SEDEs administradas, cuando falta ep_sede_id
};

/** Unión de respuesta */
export type MatriculaImportResponse = MatriculaImportOk | MatriculaImportFail;

/** Payload que enviamos al backend (multipart/form-data) */
export interface MatriculaImportPayload {
  periodo_id: Id;        // obligatorio
  ep_sede_id?: Id | null;
  file: File;            // obligatorio
}
