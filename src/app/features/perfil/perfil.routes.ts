// src/app/pages/perfil/perfil.routes.ts
import { Routes } from '@angular/router';

export const PERFIL_ROUTES: Routes = [
  // /perfil  → redirige a /perfil/datos
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'datos',
  },

  // /perfil/datos  → Mi perfil (datos + cambio de contraseña)
  {
    path: 'datos',
    title: 'Mi perfil',
    loadComponent: () =>
      import('./pages/perfil/perfil.page').then(m => m.PerfilPage),
    data: {
      feature: 'perfil',
      section: 'datos',
    },
  },

  // /perfil/sesiones → Sesiones de inicio de sesión
  {
    path: 'sesiones',
    title: 'Sesiones activas',
    loadComponent: () =>
      import('./pages/perfil-sessions/perfil-sessions.page')
        .then(m => m.PerfilSessionsPage),
    data: {
      feature: 'perfil',
      section: 'sesiones',
    },
  },

  // fallback
  {
    path: '**',
    redirectTo: 'datos',
  },
];

export default PERFIL_ROUTES;
