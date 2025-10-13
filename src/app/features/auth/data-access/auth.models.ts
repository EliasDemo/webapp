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
  rol_principal: string | null;
  permissions: string[];
}

export interface AcademicoSummary {
  escuela_profesional: string | null;
  sede: string | null;
  expediente_id: number | null;
}

export interface LookupResponse {
  ok: boolean;
  user: UserSummary;
  academico: AcademicoSummary | null;
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  user: UserSummary;
  academico: AcademicoSummary | null;
}
