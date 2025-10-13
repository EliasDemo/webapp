export interface Universidad {
  id: number;
  codigo: string | null;
  nombre: string | null;
  tipo_gestion?: string | null;
  estado_licenciamiento?: string | null;
}

export interface Facultad {
  id: number;
  codigo: string | null;
  nombre: string | null;
  universidad?: Universidad | null;
}

export interface EscuelaProfesional {
  id: number;
  codigo: string | null;
  nombre: string | null;
  facultad?: Facultad | null;
}

export interface Sede {
  id: number;
  nombre: string | null;
  es_principal?: boolean;
  esta_suspendida?: boolean;
}

export interface ExpedienteDetail {
  id: number;
  estado: string | null;
  codigo_estudiante?: string | null;
  grupo?: string | null;
  correo_institucional?: string | null;
  sede?: Sede | null;
  escuela_profesional?: EscuelaProfesional | null;
  facultad?: Facultad | null;
  universidad?: Universidad | null;
}

export interface UserDetail {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  status: string | null;

  profile_photo: string | null;
  profile_photo_url: string | null;

  roles: string[];
  rol_principal: string | null;
  permissions: string[];

  expediente_activo: ExpedienteDetail | null;
  expedientes?: ExpedienteDetail[];
}

export interface MeResponse {
  ok: boolean;
  user: UserDetail;
}
