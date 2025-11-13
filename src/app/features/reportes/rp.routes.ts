import { Routes } from '@angular/router';

export const RP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'horas' },

  // Permite entrar sin :epSedeId (la página mostrará aviso)
  {
    path: 'horas',
    title: 'Reportes · Horas por período',
    loadComponent: () =>
      import('./pages/reportes/rp-horas.page').then(m => m.RpHorasPage),
    data: { feature: 'reportes', level: 'horas' },
  },

  // Con parámetro :epSedeId (lo toma la página para consultar/exportar)
  {
    path: 'horas/:epSedeId',
    title: 'Reportes · Horas por período',
    loadComponent: () =>
      import('./pages/reportes/rp-horas.page').then(m => m.RpHorasPage),
    data: { feature: 'reportes', level: 'horas' },
  },

  { path: '**', redirectTo: 'horas' },
];

export default RP_ROUTES;
