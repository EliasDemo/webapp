import { Routes } from '@angular/router';
import { authMatchGuard } from '../../core/http/auth.guard';

export const H_ROUTES: Routes = [
  {
    path: '',
    canMatch: [authMatchGuard],
    children: [
      // Historial de horas (mío)
      {
        path: 'horas',
        loadComponent: () =>
          import('./pages/history/history.page').then(m => m.HistoryPage),
      },

      // Historial de horas por expediente (opcional, mismo componente leyendo :expedienteId si lo necesitas)
      {
        path: 'horas/expedientes/:expedienteId',
        loadComponent: () =>
          import('./pages/history/history.page').then(m => m.HistoryPage),
      },

      // Redirección por defecto
      { path: '', pathMatch: 'full', redirectTo: 'horas' },
    ],
  },
];
