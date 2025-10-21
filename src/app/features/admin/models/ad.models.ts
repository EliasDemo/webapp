// Tipos base
export type ApiResponse<T> = { ok: boolean; data: T; meta?: any };
export type Page<T> = { items?: T[]; total?: number; page?: number; per_page?: number };

// ─────────────────────────────────────────────────────────────
// Admin: Roles y Permisos
// ─────────────────────────────────────────────────────────────

export interface AdPermission {
  id: number;
  name: string;
  guard_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdRole {
  id: number;
  name: string;
  guard_name: string;
  users_count?: number;
  permissions?: AdPermission[];
  created_at?: string;
  updated_at?: string;
}

export interface RoleFilter {
  guard?: string;
  search?: string;
  page?: number;
}

export interface RoleCreatePayload {
  name: string;
  guard_name?: string;
}

export interface RoleRenamePayload {
  name: string;
  guard_name?: string;
}

export interface AssignPermissionsPayload {
  permissions: string[];
}

// (Opcional)
export interface UserLite {
  id: number;
  name: string;
  email?: string;
  created_at?: string;
}

// ==============================
// Universidad
// ==============================
export interface AdImagen {
  id: number;
  url?: string | null;
  url_publica?: string | null;
  path?: string | null;
  titulo?: 'LOGO' | 'PORTADA' | string;
  visibilidad?: 'PUBLICA' | 'RESTRINGIDA' | string;
  created_at?: string;
  updated_at?: string;
}

export interface Universidad {
  id: number;
  codigo: string;
  nombre: string;
  tipo_gestion: string;
  estado_licenciamiento: string;
  logo?: AdImagen | null;
  portada?: AdImagen | null;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────────────────────
// ACADÉMICO - Tipos
// ─────────────────────────────────────────────────────────────

export interface Facultad {
  id: number;
  codigo: string;
  nombre: string;
  universidad_id: number;
  meta?: { created_at?: string; updated_at?: string };
}

export interface FacultadLite {
  id: number;
  codigo: string;
  nombre: string;
}

export interface FacultadCreatePayload {
  universidad_id: number;
  codigo: string;
  nombre: string;
}

export interface Sede {
  id: number;
  nombre: string;
  es_principal: boolean;
  esta_suspendida: boolean;
  universidad_id?: number;
  meta?: { created_at?: string; updated_at?: string };
}

export interface SedeCreatePayload {
  universidad_id: number;
  nombre: string;
  es_principal?: boolean;
  esta_suspendida?: boolean;
}

export interface SedeRefWithPivot {
  id: number;
  nombre: string;
  pivot?: {
    vigente_desde?: string | null;
    vigente_hasta?: string | null;
    created_at?: string;
    updated_at?: string;
  };
}

export interface EscuelaProfesional {
  id: number;
  codigo: string;
  nombre: string;
  facultad_id: number;

  // (Opcional) si el BE carga 'facultad'
  facultad?: FacultadLite;

  // Sedes a las que está vinculada (cuando el BE carga 'sedes')
  sedes?: SedeRefWithPivot[];

  meta?: { created_at?: string; updated_at?: string };
}

export interface EscuelaProfesionalCreatePayload {
  facultad_id: number;
  codigo: string;
  nombre: string;
}

/**
 * Payload para la tabla ep_sede (vinculación EP <-> Sede)
 * vigente_desde / vigente_hasta en formato ISO YYYY-MM-DD (o null)
 */
export interface EpSedePayload {
  sede_id: number;
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
}

/** Tipo híbrido para UI: inyecta vigencias precomputadas */
export interface EscuelaProfesionalWithVig extends EscuelaProfesional {
  _vigente_desde?: string | null;
  _vigente_hasta?: string | null;
}
