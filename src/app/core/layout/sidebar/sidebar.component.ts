// src/app/core/layout/sidebar/sidebar.component.ts
import { Component, EventEmitter, Input, Output, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserStore } from '../../state/user.store';

type NavItem = {
  route: string;
  label: string;
  icon: string;
  activeClass: string;
  indicatorClass: string;
  iconActiveClass: string;
  iconActiveColor: string;
  textActiveColor: string;
  badge?: string;
  badgeClass?: string;
  exact?: boolean;

  // Permisos (opcional)
  perms?: string | string[];
  any?: boolean; // permisos: true = basta 1; false/undefined = requiere todos

  // Roles (opcional)
  roles?: string | string[]; // e.g. 'ADMINISTRADOR' o ['ADMINISTRADOR','COORDINADOR']
  roleAny?: boolean;         // roles: true = basta 1; false/undefined = requiere todos
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private store = inject(UserStore);

  infoOpen = false;
  toggleInfo() { this.infoOpen = !this.infoOpen; }

  @Input() compact = true;
  @Input() showToggle = true;
  @Output() itemClick = new EventEmitter<void>();
  @Output() toggleExpand = new EventEmitter<void>();

  // señales del store (usadas en la plantilla como funciones)
  universidad = this.store.universidad;
  sede        = this.store.sede;
  facultad    = this.store.facultad;
  escuela     = this.store.escuela;

  // Ítems (ahora con `perms` y `roles` donde corresponda)
  navigationItems: NavItem[] = [
    {
      route: '/dashboard',
      label: 'Dashboard',
      icon: 'fas fa-pen text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',
      exact: true
      // público para autenticados (sin permisos/roles)
    },
    {
      route: '/vm/proyectos',
      label: 'Proyectos',
      icon: 'fas fa-diagram-project text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',
      badge: 'Nuevo',
      badgeClass: 'bg-green-500 text-white',
      exact: false,
      perms: 'vm.proyecto.read',       // requiere permiso
      // roles: 'COORDINADOR',          // (opcional) además exigir rol -> AND
    },
    {
      route: '/events',
      label: 'Eventos',
      icon: 'fas fa-calendar-days text-base',
      activeClass: 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
      indicatorClass: 'bg-gradient-to-b from-amber-500 to-orange-500',
      iconActiveClass: 'bg-amber-500/20 shadow-md',
      iconActiveColor: 'text-amber-600 dark:text-amber-400',
      textActiveColor: 'text-amber-700 dark:text-amber-300',
      exact: true,
      perms: 'vm.evento.read',
    },
    {
      route: '/vm/sesiones/proximas',
      label: 'Sesiones Próximas',
      icon: 'fas fa-clock text-base',
      activeClass: 'bg-sky-50/80 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300',
      indicatorClass: 'bg-gradient-to-b from-sky-500 to-cyan-500',
      iconActiveClass: 'bg-sky-500/20 shadow-md',
      iconActiveColor: 'text-sky-600 dark:text-sky-400',
      textActiveColor: 'text-sky-700 dark:text-sky-300',
      badge: '3',
      badgeClass: 'bg-blue-500 text-white',
      exact: true,
      // visible si tiene cualquiera de estos permisos
      perms: ['vm.sesion.read', 'vm.agenda.staff.read'],
      any: true,
    },
    {
      route: '/mis-proyectos',
      label: 'Mis Proyectos',
      icon: 'fas fa-folder-open text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',
      exact: true,
      roles: 'ESTUDIANTE',
      // accesible a estudiantes autenticados
    },
    {
      route: '/h/horas',
      label: 'Historia',
      icon: 'fas fa-clock-rotate-left text-base',
      activeClass: 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
      indicatorClass: 'bg-gradient-to-b from-emerald-500 to-teal-500',
      iconActiveClass: 'bg-emerald-500/20 shadow-md',
      iconActiveColor: 'text-emerald-600 dark:text-emerald-400',
      textActiveColor: 'text-emerald-700 dark:text-emerald-300',
      exact: true,
      roles: 'ESTUDIANTE',
      // accesible a estudiantes autenticados
    },

    {
      route: '/settings',
      label: 'Configuración',
      icon: 'fas fa-cog text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',
      exact: true,
      // EJEMPLO: proteger por rol (solo ADMIN)
      roles: 'ADMINISTRADOR',
      // Para varios roles (cualquiera):
      // roles: ['ADMINISTRADOR','COORDINADOR'], roleAny: true
    },

    {
      route: '/ad/roles',
      label: 'Roles & Permisos',
      icon: 'fas fa-user-shield text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',

      // Si quieres que solo se active en la lista raíz
      // (no en hijos como /ad/roles/123), deja exact: true.
      // Si quieres que se active también en hijos, pon exact: false.
      exact: false,

      // Proteger por rol (solo ADMIN)
      roles: 'ADMINISTRADOR',

      // Para varios roles (cualquiera):
      // roles: ['ADMINISTRADOR','COORDINADOR'], roleAny: true
    },

    {
      route: '/ad/universidad',
      label: 'Universidad',
      icon: 'fas fa-university text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-purple-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',

      // Si quieres que solo se active en la raíz (/ad/universidad) pon exact: true.
      // Si tendrá subrutas (/ad/universidad/logo, /portada, etc.), usa false.
      exact: false,

      // Restringido a ADMINISTRADOR
      roles: 'ADMINISTRADOR',

      // Para varios roles (cualquiera):
      // roles: ['ADMINISTRADOR','COORDINADOR'], roleAny: true
    },

    {
      route: '/ad/sedes',
      label: 'Sedes Universitarias',
      icon: 'fas fa-map-marker-alt text-base',
      activeClass: 'bg-blue-50/80 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
      indicatorClass: 'bg-gradient-to-b from-blue-500 to-cyan-500',
      iconActiveClass: 'bg-blue-500/20 shadow-md',
      iconActiveColor: 'text-blue-600 dark:text-blue-400',
      textActiveColor: 'text-blue-700 dark:text-blue-300',

      // Exact false porque tendrá subrutas (detalle, crear, etc.)
      exact: false,

      // Visible solo para ADMINISTRADOR
      roles: 'ADMINISTRADOR',

      // (Opcional) para múltiples roles con acceso
      // roles: ['ADMINISTRADOR', 'COORDINADOR'], roleAny: true
    },

    {
      route: '/m/import',
      label: 'Matrículas · Registro',
      icon: 'fas fa-file-excel text-base',
      activeClass: 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
      indicatorClass: 'bg-gradient-to-b from-emerald-500 to-green-500',
      iconActiveClass: 'bg-emerald-500/20 shadow-md',
      iconActiveColor: 'text-emerald-600 dark:text-emerald-400',
      textActiveColor: 'text-emerald-700 dark:text-emerald-300',
      exact: false,
      roles: 'ENCARGADO',
    },

    {
      route: '/r/horas',
      label: 'Reportes · Horas por período',
      icon: 'fas fa-clock-rotate-left text-base',
      activeClass: 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300',
      indicatorClass: 'bg-gradient-to-b from-indigo-500 to-violet-500',
      iconActiveClass: 'bg-indigo-500/20 shadow-md',
      iconActiveColor: 'text-indigo-600 dark:text-indigo-400',
      textActiveColor: 'text-indigo-700 dark:text-indigo-300',
      exact: false, // así también queda activo en /r/horas/123
      roles: 'ENCARGADO', // ajusta a tu control de roles ('GESTOR', etc.)
    }








  ];

  // ¿Puede ver el ítem?
  private canShow = (item: NavItem): boolean => {
    // ---- permisos
    const permOk = (() => {
      if (!item.perms) return true;
      const perms = Array.isArray(item.perms) ? item.perms : [item.perms];
      return item.any ? this.store.hasAny(perms) : this.store.hasAll(perms);
    })();

    // ---- roles
    const roleOk = (() => {
      if (!item.roles) return true;
      const roles = Array.isArray(item.roles) ? item.roles : [item.roles];
      return item.roleAny ? this.store.hasAnyRole(roles) : this.store.hasAllRole(roles);
    })();

    // Si hay ambos, se exige AND
    return permOk && roleOk;
  };

  // Lista filtrada que usa la plantilla
  visibleItems = computed(() => this.navigationItems.filter(i => this.canShow(i)));

  trackByRoute = (_: number, item: NavItem) => item.route;
}
