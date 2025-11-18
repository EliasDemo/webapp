import { Routes } from '@angular/router';

export const MP_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis proyectos',
    loadComponent: () =>
      import('./pages/list/mp-list.page').then(m => m.MpListPage),
    data: { feature: 'mis-proyectos', level: 'list' },
  },

  {
    path: ':id',
    title: 'Detalle del proyecto',
    loadComponent: () =>
      import('./pages/view/mp-view.page').then(m => m.MpViewPage),
    data: { feature: 'mis-proyectos', level: 'view' },
  },

  { path: '**', redirectTo: '' },
];

export default MP_ROUTES;
