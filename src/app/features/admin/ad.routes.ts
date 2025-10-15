// src/app/features/admin/ad.routes.ts
import { Routes } from '@angular/router';

export const AD_ROUTES: Routes = [
  // redirige al listado de roles
  { path: '', pathMatch: 'full', redirectTo: 'roles' },

  // ─────────────────────────────────────────────
  // ROLES
  // ─────────────────────────────────────────────
  {
    path: 'roles',
    // canActivate: [AdminGuard], // opcional si tienes guard en FE
    children: [
      {
        path: '',
        title: 'Roles & Permisos',
        loadComponent: () =>
          import('./pages/rolehaspermission-list/rolehaspermission-list.page')
            .then(m => m.RoleHasPermissionListPage),
        data: { feature: 'admin', level: 'roles-list' }
      },

      //  ⚠️ Rutas específicas SIEMPRE antes de :id
       {
         path: 'nuevo',
         title: 'Crear rol',
         loadComponent: () =>
           import('./pages/rolehaspermission-create/rolehaspermission-create.page')
             .then(m => m.RoleHasPermissionCreatePage),
         data: { feature: 'admin', level: 'roles-create' }
       },
      // {
      //   path: ':id/asignar-permisos',
      //   title: 'Asignar permisos al rol',
      //   loadComponent: () =>
      //     import('./pages/role-assign-permissions/role-assign-permissions.page')
      //       .then(m => m.RoleAssignPermissionsPage),
      //   data: { feature: 'admin', level: 'roles-assign-perms' }
      // },
      // {
      //   path: ':id/editar',
      //   title: 'Editar rol',
      //   loadComponent: () =>
      //     import('./pages/role-edit/role-edit.page')
      //       .then(m => m.RoleEditPage),
      //   data: { feature: 'admin', level: 'roles-edit' }
      // },

      // Detalle del rol (después de las específicas)
       {
        path: ':id',
        title: 'Detalle del rol',
        loadComponent: () =>
          import('./pages/rolehaspermission-show/rolehaspermission-show.page')
            .then(m => m.RoleHasPermissionShowPage), // 👈 OJO: nombre correcto del componente
        data: { feature: 'admin', level: 'roles-view' },
      },
    ],
  },

  {
  path: 'universidad',
  title: 'Universidad',
  loadComponent: () =>
    import('./pages/universidad/universidad.page')
      .then(m => m.UniversidadPage),
  data: { feature: 'admin', level: 'universidad' }
},


  // ─────────────────────────────────────────────
  // PERMISOS (solo lectura en tu BE)
  // ─────────────────────────────────────────────
  {
    path: 'permisos',
    children: [
      // {
      //   path: '',
      //   title: 'Permisos',
      //   loadComponent: () =>
      //     import('./pages/permission-list/permission-list.page')
      //       .then(m => m.PermissionListPage),
      //   data: { feature: 'admin', level: 'perm-list' }
      // },
      // {
      //   path: ':id',
      //   title: 'Detalle del permiso',
      //   loadComponent: () =>
      //     import('./pages/permission-view/permission-view.page')
      //       .then(m => m.PermissionViewPage),
      //   data: { feature: 'admin', level: 'perm-view' }
      // },
    ],
  },

  // catch-all
  { path: '**', redirectTo: 'roles' },
];

export default AD_ROUTES;
