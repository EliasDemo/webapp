import { Routes } from '@angular/router';

export const M_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'import' },

  {
    path: 'import',
    title: 'Matrículas · Importación',
    loadComponent: () =>
      import('./pages/import/matriculas-import.page')
        .then(m => m.MatriculasImportPage),
    data: { feature: 'matriculas', level: 'import' },
  },

  {
    path: 'manual',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'buscar' },
      {
        path: 'buscar',
        title: 'Matrículas · Búsqueda manual',
        loadComponent: () =>
          import('./pages/manual/search/m-manual-search.page')
            .then(m => m.MManualSearchPage),
        data: { feature: 'matriculas', level: 'manual-search' },
      },
      {
        path: 'registrar',
        title: 'Matrículas · Registrar/Editar',
        loadComponent: () =>
          import('./pages/manual/registrar/m-manual-registrar.page')
            .then(m => m.MManualRegistrarPage),
        data: { feature: 'matriculas', level: 'manual-registrar' },
      },
      {
        path: 'matricular',
        title: 'Matrículas · Matricular',
        loadComponent: () =>
          import('./pages/manual/matricular/m-manual-matricular.page')
            .then(m => m.MManualMatricularPage),
        data: { feature: 'matriculas', level: 'manual-matricular' },
      },
    ]
  },

  { path: '**', redirectTo: 'import' },
];

export default M_ROUTES;
