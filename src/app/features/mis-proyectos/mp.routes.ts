import { Routes } from '@angular/router';

export const MP_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis proyectos',
    loadComponent: () =>
      import('./pages/list/mp-list.page').then(m => m.MpListPage),
    data: { feature: 'mis-proyectos', level: 'list' }
  },

  // ✅ Esta ruta va antes de :id
  {
    path: 'sesiones/:sesionId/register-qr',
    title: 'Registrar asistencia (QR)',
    loadComponent: () =>
      import('./pages/register-qr/register-qr.page').then(m => m.RegisterQrPage),
    data: { feature: 'vm', level: 'qr-student' }
  },

  {
    path: ':id',
    title: 'Detalle del proyecto',
    loadComponent: () =>
      import('./pages/view/mp-view.page').then(m => m.MpViewPage),
    data: { feature: 'mis-proyectos', level: 'view' }
  },

  { path: '**', redirectTo: '' }
];

export default MP_ROUTES;
