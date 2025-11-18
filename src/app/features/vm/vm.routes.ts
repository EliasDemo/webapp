// ✅ FILE: src/app/vm/proyectos/vm-proyectos.routes.ts
import { Routes } from '@angular/router';
import { authMatchGuard } from '../../core/http/auth.guard';

export const VM_PROYECTOS_ROUTES: Routes = [
  {
    path: '',
    canMatch: [authMatchGuard],
    children: [
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./pages/proyecto-list/proyecto-list.page').then(m => m.ProyectoListPage),
      },
      {
        path: 'proyectos/nuevo',
        loadComponent: () =>
          import('./pages/proyecto-wizard/proyecto-wizard.page').then(m => m.ProyectoWizardPage),
      },

      {
        path: 'proyectos/:proyectoId/registrantes',
        loadComponent: () =>
          import('./pages/proyecto-list-registrants/proyecto-list-registrants')
            .then(m => m.ProyectoListRegistrantsPage),
      },

      {
        path: 'proyectos/:proyectoId',
        loadComponent: () =>
          import('./pages/proyecto-view/proyecto-view.page').then(m => m.ProyectoViewPage),
      },

      // ─── Sesiones ───
      {
        path: 'sesiones/proximas',
        loadComponent: () =>
          import('./pages/upcoming-sessions/upcoming-sessions.page').then(m => m.UpcomingSessionsPage),
      },
      {
        path: 'sesiones/:sesionId/qr',
        loadComponent: () =>
          import('./pages/proyecto-qr/proyecto-qr.page').then(m => m.ProyectoQrPage),
      },
      {
        path: 'sesiones/:sesionId/asistencia',
        loadComponent: () =>
          import('./pages/proyecto-assistance/proyecto-assistance.page').then(m => m.ProyectoAssistancePage),
      },

      // 🔹 AQUÍ montas las rutas de eventos bajo /vm/eventos/...
      {
        path: 'eventos',
        loadChildren: () =>
          import('../events/ev.routes').then(m => m.EV_ROUTES),
      },

      { path: '', pathMatch: 'full', redirectTo: 'proyectos' },
    ],
  },
];
