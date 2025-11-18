// ─────────────────────────────────────────────
// Modelos para Perfil / Sesiones
// ─────────────────────────────────────────────

export interface UserSession {
  id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  last_activity: string; // ISO-8601
  is_current: boolean;
}

export interface ExpedienteLite {
  id: number;
  ep_sede_id: number;
  codigo_estudiante?: string | null;
  grupo?: string | null;
  ciclo?: string | null;
  correo_institucional?: string | null;
  estado: string;
  rol: string;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;

  [key: string]: any;
}

/**
 * Estructura base del detalle de usuario que viene del backend
 * (UserDetailResource), con margen para campos extra.
 */
export interface UserDetail {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;

  profile_photo?: string | null;
  celular?: string | null;
  religion?: string | null;

  status?: string;
  doc_tipo?: string | null;
  doc_numero?: string | null;
  pais?: string | null;
  fecha_nacimiento?: string | null;
  failed_login_attempts?: number;
  login_blocked_until?: string | null;

  expedientesAcademicos?: ExpedienteLite[];

  [key: string]: any;
}

export interface MeResponse {
  ok: boolean;
  user: UserDetail;
}

export interface SimpleOkResponse {
  ok: boolean;
  message?: string;
}

export interface SessionsResponse {
  ok: boolean;
  sessions: UserSession[];
}

export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/**
 * Campos que el usuario puede editar desde el front:
 *  - first_name, last_name, email
 *  - profile_photo (File)
 *  - celular, religion
 *  - correo_institucional (vinculado a un expediente)
 */
export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string | null;
  celular?: string | null;
  religion?: string | null;

  profile_photo?: File | null;

  correo_institucional?: string | null;
  expediente_id?: number;
}
// ─────────────────────────────────────────────
// Modelos para Perfil / Sesiones
// ─────────────────────────────────────────────

export interface UserSession {
  id: string;
  ip_address?: string | null;
  user_agent?: string | null;
  last_activity: string; // ISO-8601
  is_current: boolean;

  // opcional, por si el backend lo envía
  created_at?: string | null;
}

/**
 * Alias para usar en los componentes
 * (la page importa SessionItem).
 */
export type SessionItem = UserSession;

export interface SessionsResponse {
  ok: boolean;
  sessions: UserSession[];
}
