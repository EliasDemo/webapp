import { Routes } from '@angular/router';

export const MIS_EVENTOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis eventos',
    loadComponent: () =>
      import('./mis-eventos-list/mis-vent-list').then(
        m => m.MisVentListPage
      ),
    data: { feature: 'mis-eventos', level: 'list' },
  },
  {
    path: ':id',
    title: 'Detalle de evento',
    loadComponent: () =>
      import('./mis-eventos-view/mis-vent-view').then(
        m => m.MisVentViewPage
      ),
    data: { feature: 'mis-eventos', level: 'view' },
  },
  { path: '**', redirectTo: '' },
];

export default MIS_EVENTOS_ROUTES;
