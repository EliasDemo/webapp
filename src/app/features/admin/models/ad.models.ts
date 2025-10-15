// ─────────────────────────────────────────────────────────────
// Tipos base (puedes reutilizar los de eventos si ya existen)
// ─────────────────────────────────────────────────────────────

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
  users_count?: number;               // si el BE lo expone con withCount
  permissions?: AdPermission[];       // si el BE hace ->with('permissions')
  created_at?: string;
  updated_at?: string;
}

export interface RoleFilter {
  guard?: string;  // p.ej. 'api'
  search?: string; // si decides filtrar por nombre en el BE
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
  permissions: string[]; // nombres de permisos
}

// (Opcional) si expones /roles/{id}/users
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
  url_publica?: string | null; // fallback por si el Resource la expone así
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
  tipo_gestion: string;          // p.ej. 'PUBLICO' | 'PRIVADO'
  estado_licenciamiento: string; // p.ej. 'NINGUNO' | 'LICENCIADA' | ...
  logo?: AdImagen | null;
  portada?: AdImagen | null;
  created_at?: string;
  updated_at?: string;
}
