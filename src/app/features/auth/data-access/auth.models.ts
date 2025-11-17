export type Username = string;

export interface LookupRequest {
  username: Username;
}

export interface LoginRequest {
  username: Username;
  password: string;
}

export interface UserSummary {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  profile_photo: string | null;
  roles: string[];
  rol_principal?: string | null;   // puede no venir en lookup
  permissions?: string[];          // puede no venir en lookup
}

export interface AcademicoSummary {
  escuela_profesional: string | null;
  sede: string | null;
  expediente_id?: number | null;   // en lookup quizá no lo mandas, por eso opcional
}

export interface LookupResponse {
  ok: boolean;
  user: UserSummary;              // versión reducida (sin permisos está bien)
  academico: AcademicoSummary | null;
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  user: UserSummary;              // versión completa (puede incluir permisos)
  academico: AcademicoSummary | null;
}
