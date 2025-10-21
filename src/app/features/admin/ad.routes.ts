import { Routes } from '@angular/router';

export const AD_ROUTES: Routes = [
  // redirect por defecto
  { path: '', pathMatch: 'full', redirectTo: 'roles' },

  // ─────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────
  {
    path: 'roles',
    children: [
      {
        path: '',
        title: 'Roles & Permisos',
        loadComponent: () =>
          import('./pages/rolehaspermission-list/rolehaspermission-list.page')
            .then(m => m.RoleHasPermissionListPage),
        data: { feature: 'admin', level: 'roles-list' }
      },
      {
        path: 'nuevo',
        title: 'Crear rol',
        loadComponent: () =>
          import('./pages/rolehaspermission-create/rolehaspermission-create.page')
            .then(m => m.RoleHasPermissionCreatePage),
        data: { feature: 'admin', level: 'roles-create' }
      },
      {
        path: ':id',
        title: 'Detalle del rol',
        loadComponent: () =>
          import('./pages/rolehaspermission-show/rolehaspermission-show.page')
            .then(m => m.RoleHasPermissionShowPage),
        data: { feature: 'admin', level: 'roles-view' },
      },
    ],
  },

  // ─────────────────────────────────────────────
  // UNIVERSIDAD
  // ─────────────────────────────────────────────
  {
    path: 'universidad',
    title: 'Universidad',
    loadComponent: () =>
      import('./pages/universidad/universidad.page')
        .then(m => m.UniversidadPage),
    data: { feature: 'admin', level: 'universidad' }
  },

  // ─────────────────────────────────────────────
  // SEDES UNIVERSITARIAS + catálogo académico
  // ─────────────────────────────────────────────
  {
    path: 'sedes',
    children: [
      {
        path: '',
        title: 'Sedes Universitarias',
        loadComponent: () =>
          import('./pages/sedes-list/sedes-list.page')
            .then(m => m.SedesListPage),
        data: { feature: 'admin', level: 'sedes-list' }
      },
      {
        path: 'nueva',
        title: 'Crear Sede',
        loadComponent: () =>
          import('./pages/sedes-create/sedes-create.page')
            .then(m => m.SedeCreatePage),
        data: { feature: 'admin', level: 'sedes-create' }
      },
      {
        path: ':id',
        title: 'Detalle de la Sede',
        loadComponent: () =>
          import('./pages/sede-detail/sede-detail.page')
            .then(m => m.SedeDetailPage),
        data: { feature: 'admin', level: 'sedes-view' }
      },
      {
        path: ':id/asignar-ep',
        title: 'Asignar Escuela a Sede',
        loadComponent: () =>
          import('./pages/assign-ep-sede/assign-ep-sede.page')
            .then(m => m.AssignEpSedePage),
        data: { feature: 'admin', level: 'sedes-assign-ep' }
      },
    ],
  },

  // creación directa de catálogo
  {
    path: 'facultades/nueva',
    title: 'Crear Facultad',
    loadComponent: () =>
      import('./pages/facultad-create/facultad-create.page')
        .then(m => m.FacultadCreatePage),
    data: { feature: 'admin', level: 'facultades-create' }
  },
  {
    path: 'escuelas-profesionales/nueva',
    title: 'Crear Escuela Profesional',
    loadComponent: () =>
      import('./pages/ep-create/ep-create.page')
        .then(m => m.EpCreatePage),
    data: { feature: 'admin', level: 'ep-create' }
  },

  // catch-all
  { path: '**', redirectTo: 'roles' },
];

export default AD_ROUTES;
