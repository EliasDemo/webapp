import { Routes } from '@angular/router';

export const RP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'horas' },

  {
    path: 'horas',
    title: 'Reportes · Horas por período',
    loadComponent: () =>
      import('./pages/reportes/rp-horas.page').then(m => m.RpHorasPage),
    data: { feature: 'reportes', level: 'horas' },
  },

  {
    path: 'horas/:epSedeId',
    title: 'Reportes · Horas por período',
    loadComponent: () =>
      import('./pages/reportes/rp-horas.page').then(m => m.RpHorasPage),
    data: { feature: 'reportes', level: 'horas' },
  },

  {
    path: 'avance',
    title: 'Reportes · Mi avance por proyecto',
    loadComponent: () =>
      import('./pages/reportes/rp-avance.page').then(m => m.RpAvancePage),
    data: { feature: 'reportes', level: 'avance' },
  },

  // 🆕 Importar horas históricas (con loader propio)
  {
    path: 'import/historico-horas',
    title: 'Reportes · Importar horas históricas',
    loadComponent: () =>
      import('./pages/reportes/rp-import-historico-horas.page')
        .then(m => m.RpImportHistoricoHorasPage),
    data: {
      feature: 'reportes',
      level: 'import-historico-horas',
      customLoader: true,          // 👈 clave para que el Shell oculte el loader global
    },
  },

  { path: '**', redirectTo: 'horas' },
];

export default RP_ROUTES;
