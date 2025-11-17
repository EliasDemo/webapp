// app.routes.ts
import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell/shell.component';
import { authMatchGuard } from './core/http/auth.guard';
import { NoAutorizadoPage } from './features/misc/no-autorizado.page';

export const routes: Routes = [
  // Públicas (auth)
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/pages/login.page').then(m => m.LoginPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },

  // Privadas (Shell + guard)
  {
    path: '',
    component: ShellComponent,
    canMatch: [authMatchGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then(m => m.SettingsPage),
      },

      // VM (ya existente)
      {
        path: 'vm',
        loadChildren: () =>
          import('./features/vm/vm.routes').then(m => m.VM_PROYECTOS_ROUTES),
      },

      // ➜ Mis Proyectos (nuevo)
      {
        path: 'mis-proyectos',
        loadChildren: () =>
          import('./features/mis-proyectos/mp.routes').then(m => m.MP_ROUTES),
        // Si exportaste como default en mp.routes.ts, usa:
        // loadChildren: () => import('./features/mis-proyectos/mp.routes').then(m => m.default),
      },

      {
        path: 'events',
        loadChildren: () =>
          import('./features/events/ev.routes').then(m => m.EV_ROUTES),
        // si exportas default en ev.routes.ts, puedes usar:
        // loadChildren: () => import('./features/events/ev.routes').then(m => m.default),
      },

      {
        path: 'ad',
        loadChildren: () => import('./features/admin/ad.routes').then(m => m.AD_ROUTES),
        // canActivate: [AdminGuard] // opcional
      },

        {
        path: 'h',
        loadChildren: () =>
          import('./features/hours/h.routes').then(m => m.H_ROUTES),
      },

      {
        path: 'm',
        loadChildren: () =>
          import('./features/matriculas/m.routes').then(m => m.M_ROUTES),
      },

      {
        path: 'r',
        loadChildren: () =>
          import('./features/reportes/rp.routes').then(m => m.RP_ROUTES),
        // Si exportas default:
        // loadChildren: () => import('./features/reportes/rp.routes').then(m => m.default),
      },

            {
        path: 'staff',
        loadChildren: () =>
          import('./features/ep-sede-staff/ep-sede-staff.routes')
            .then(m => m.ESS_ROUTES),
        // si exportas default en el archivo de rutas, también puedes usar:
        // loadChildren: () =>
        //   import('./features/ep-sede-staff/ep-sede-staff.routes')
        //     .then(m => m.default),
      },




        { path: 'no-autorizado', component: NoAutorizadoPage },

      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },

  { path: '**', redirectTo: '' },
];
