// src/app/features/ep-sede-staff/models/ep-sede-staff.models.ts

// ─────────────────────────────────────────────────────────────
// EP-Sede: Staff (COORDINADOR / ENCARGADO)
// Modelos para FE (Angular)
// ─────────────────────────────────────────────────────────────

/** Envoltorio estándar genérico con ok:true/false */
export type ApiOk<T> = {
  ok: true;
  data: T;
  meta?: any;
  message?: string;
};

export type ApiFail = {
  ok: false;
  message: string;
  code?: string;
  meta?: any;
};

export type ApiResponse<T> = ApiOk<T> | ApiFail;

/** Roles de staff manejados en este módulo. */
export type StaffRole = 'COORDINADOR' | 'ENCARGADO';

/** Status del usuario según tu enum de BD. */
export type StaffUserStatus = 'active' | 'view_only' | 'suspended';

/** Evento de historial según tu migración ep_sede_staff_historial. */
export type StaffEvento =
  | 'ASSIGN'
  | 'UNASSIGN'
  | 'REINSTATE'
  | 'DELEGATE'
  | 'AUTO_END'
  | 'TRANSFER';

// ─────────────────────────────────────────────────────────────
// Contexto del panel de staff (/api/ep-sedes/staff/context)
// ─────────────────────────────────────────────────────────────

export type EpSedeStaffPanelMode = 'ADMIN' | 'COORDINADOR' | 'LIMITED';

export interface EpSedeStaffContextUser {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  roles?: string[];
}

export interface EpSedeStaffContextPermissions {
  manage_coordinador: boolean;
  manage_encargado: boolean;
}

/** EP-Sede resumida para el <select> del panel. */
export interface EpSedeStaffContextEpSede {
  id: number;
  label: string; // 👈 coincide con el backend (id + nombre bonito)
}

export interface EpSedeStaffContextPayload {
  user: EpSedeStaffContextUser;

  /** ADMIN | COORDINADOR | LIMITED */
  panel_mode: EpSedeStaffPanelMode;

  /**
   * EP-Sede “principal” del usuario (ej. coordinador).
   * Puede ser null si es un admin sin EP-Sede fija.
   */
  ep_sede_id: number | null;

  /**
   * EP-Sedes sobre las que tiene alcance el usuario en el panel.
   * - Admin: normalmente todas las devueltas en `ep_sedes`.
   * - No admin: típicamente las de EpScopeService::epSedesIdsManagedBy().
   */
  ep_sede_ids: number[];

  /**
   * EP-Sedes que EpScopeService marca como gestionadas directamente.
   * (Se mantiene para compatibilidad; suele coincidir con ep_sede_ids
   *  salvo en el caso de admin).
   */
  ep_sedes_managed_ids: number[];

  /** Permisos agregados del panel. */
  permissions: EpSedeStaffContextPermissions;

  /** Flags planos (por si el componente los quiere leer así). */
  can_manage_coordinador: boolean;
  can_manage_encargado: boolean;

  /** True si el usuario tiene rol ADMINISTRADOR. */
  is_admin: boolean;

  /**
   * Listado de EP-Sedes que el usuario puede seleccionar en el panel.
   * Se usa para poblar combos, etc.
   */
  ep_sedes: EpSedeStaffContextEpSede[];
}

// ─────────────────────────────────────────────────────────────
// Staff actual
// ─────────────────────────────────────────────────────────────

/**
 * Representa al staff actual de una EP-Sede (coincide con lo que retorna
 * StaffAssignmentService::current() → controlador EpSedeStaffController::current()).
 */
export interface EpSedeStaffMember {
  user_id: number;
  user: string | null;           // "APELLIDO NOMBRE" o null
  status: StaffUserStatus | null;
  rol: StaffRole;
  vigente_desde: string | null;  // 'YYYY-MM-DD' o null
}

/** Bloque COORDINADOR/ENCARGADO que llega en el campo staff. */
export interface EpSedeStaffCurrentStaff {
  COORDINADOR: EpSedeStaffMember | null;
  ENCARGADO: EpSedeStaffMember | null;
}

/** Payload completo de /ep-sedes/{epSedeId}/staff (GET). */
export interface EpSedeStaffCurrentPayload {
  ep_sede_id: number;
  staff: EpSedeStaffCurrentStaff;
}

// ─────────────────────────────────────────────────────────────
// Historial
// ─────────────────────────────────────────────────────────────

/**
 * Ítem de historial de ep_sede_staff_historial (lo que retorna ->toArray()).
 */
export interface EpSedeStaffHistoryItem {
  id: number;
  ep_sede_id: number;
  user_id: number;
  role: StaffRole;
  evento: StaffEvento;
  desde: string | null;      // 'YYYY-MM-DD'
  hasta: string | null;      // 'YYYY-MM-DD'
  actor_id: number | null;
  motivo: string | null;
  created_at: string;        // ISO datetime
  updated_at: string;        // ISO datetime
}

/** Payload completo de /ep-sedes/{epSedeId}/staff/history (GET). */
export interface EpSedeStaffHistoryPayload {
  ep_sede_id: number;
  history: EpSedeStaffHistoryItem[];
}

// ─────────────────────────────────────────────────────────────
// Asignaciones / unassign / reinstate / delegate
// ─────────────────────────────────────────────────────────────

/** Estructura de 'assigned' en el payload del service->assign(). */
export interface EpSedeStaffAssignedInfo {
  user_id: number;
  user?: string | null;
  role: StaffRole;
  vigente_desde: string; // 'YYYY-MM-DD'
}

/** Estructura de 'previous' en el payload del service->assign(). */
export interface EpSedeStaffPreviousInfo {
  user_id: number;
  role: StaffRole;
  vigente_hasta: string; // 'YYYY-MM-DD'
}

/** Payload de assign() / reinstate() / delegate() en backend. */
export interface EpSedeStaffAssignPayload {
  ep_sede_id: number;
  assigned: EpSedeStaffAssignedInfo;
  previous: EpSedeStaffPreviousInfo | null;
}

/** Payload de unassign() en backend. */
export interface EpSedeStaffUnassignPayload {
  unassigned: {
    user_id: number | null;
    role: StaffRole;
    vigente_hasta: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// DTOs (requests) que envía el frontend
// ─────────────────────────────────────────────────────────────

/** Body para /staff/assign */
export interface EpSedeStaffAssignInput {
  role: StaffRole;
  user_id: number;
  vigente_desde?: string; // 'YYYY-MM-DD'
  exclusive?: boolean;    // por defecto true en backend
  motivo?: string;
}

/** Body para /staff/unassign */
export interface EpSedeStaffUnassignInput {
  role: StaffRole;
  motivo?: string;
}

/** Body para /staff/reinstate */
export interface EpSedeStaffReinstateInput {
  role: StaffRole;
  user_id: number;
  vigente_desde?: string; // 'YYYY-MM-DD'
  motivo?: string;
}

/** Body para /staff/delegate (ENCARGADO interino) */
export interface EpSedeStaffDelegateInput {
  role: StaffRole;   // debe ser 'ENCARGADO' para que backend acepte
  user_id: number;
  desde: string;     // 'YYYY-MM-DD'
  hasta: string;     // 'YYYY-MM-DD'
  motivo?: string;
}

// ─────────────────────────────────────────────────────────────
// Crear usuario + expediente + asignación (createAndAssign)
// ─────────────────────────────────────────────────────────────

export interface EpSedeStaffCreateAndAssignInput {
  role: string;              // 'COORDINADOR' | 'ENCARGADO' | subtipo
  username: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  doc_tipo?: 'DNI' | 'CE' | 'PASAPORTE' | 'OTRO' | null;
  doc_numero?: string | null;
  celular?: string | null;
  pais?: string | null;      // 'PE', 'ES', etc.
  vigente_desde?: string;    // 'YYYY-MM-DD'
  motivo?: string | null;
  correo_institucional?: string | null;
}

/** Parte del usuario retornado por createAndAssign. */
export interface EpSedeStaffCreatedUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: StaffUserStatus;
}

/** Respuesta completa de /staff/create-and-assign. */
export interface EpSedeStaffCreateAndAssignResponse {
  ep_sede_id: number;
  assign_role: StaffRole;  // COORDINADOR o ENCARGADO
  raw_role: string;        // role enviado (p.ej. ENCARGADO_PROYECTOS)
  user: EpSedeStaffCreatedUser;
  assignment: EpSedeStaffAssignPayload;
}

// ─────────────────────────────────────────────────────────────
// Lookup por correo (buscar perfil existente)
// ─────────────────────────────────────────────────────────────

export interface EpSedeStaffLookupUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  status: StaffUserStatus;
  roles?: string[];
}

export interface EpSedeStaffLookupExpediente {
  id: number;
  ep_sede_id: number;
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'EGRESADO' | 'CESADO' | string;
  rol: 'ESTUDIANTE' | StaffRole | string;
  correo_institucional: string | null;
  codigo_estudiante: string | null;
  vigente_desde: string | null;
  vigente_hasta: string | null;
}

export interface EpSedeStaffLookupPayload {
  email: string;
  user: EpSedeStaffLookupUser | null;
  expediente: EpSedeStaffLookupExpediente | null;
}
