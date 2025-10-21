import { Id } from './m.models';

export interface ManualAlumnoData {
  user: any;        // puedes tipar con tu User
  expediente: any;  // o tipar con tu ExpedienteAcademico
  matriculas: any[]; // idem
}

export type ManualBuscarOk = { ok: true; data: ManualAlumnoData };
export type ManualBuscarFail = { ok: false; message?: string };
export type ManualBuscarResponse = ManualBuscarOk | ManualBuscarFail;

export interface RegistrarPayload {
  ep_sede_id?: Id | null;            // opcional: backend deduce si gestionas una
  codigo_estudiante?: string | null;
  grupo?: string | null;
  correo_institucional?: string | null;
  ciclo?: string | null;
  estado?: 'ACTIVO'|'SUSPENDIDO'|'EGRESADO'|'CESADO';

  // user base:
  first_name?: string | null;
  last_name?: string | null;
  estudiante?: string | null;
  documento?: string | null;
  email?: string | null;
  celular?: string | null;
  pais?: string | null;
  religion?: string | null;
  fecha_nacimiento?: string | null; // YYYY-MM-DD
}

export type RegistrarResponse = { ok: true; data: any } | { ok: false; errors?: Record<string, string[]>, message?: string, choices?: Id[] };

export interface MatricularPayload {
  codigo_estudiante?: string | null;
  expediente_id?: Id | null;
  periodo_id: Id;
  ciclo?: string | number | null;
  grupo?: string | null;
  modalidad_estudio?: string | null; // PRESENCIAL|SEMIPRESENCIAL|VIRTUAL
  modo_contrato?: string | null;     // REGULAR|CONVENIO|BECA|OTRO
  fecha_matricula?: string | null;   // YYYY-MM-DD | null (anula)
}

export type MatricularResponse = {
  ok: true;
  message: string;
  data: { expediente_id: Id; periodo_id: Id; matricula: any; expediente: any };
} | { ok: false; message?: string; errors?: Record<string,string[]> };

export type CambiarEstadoResponse = { ok: true; data: any } | { ok: false; errors?: Record<string,string[]>, message?: string };
export type { Id } from './m.models';
