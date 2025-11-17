import { Routes } from '@angular/router';

export const ESS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ep-sede' },

  {
    path: 'ep-sede',
    title: 'Staff · EP-Sede',
    loadComponent: () =>
      import('./pages/ep-sede-staff/ep-sede-staff.page').then(m => m.EpSedeStaffPage),
    data: { feature: 'ep_sede_staff', level: 'staff' },
  },

  {
    path: 'ep-sede/:epSedeId',
    title: 'Staff · EP-Sede',
    loadComponent: () =>
      import('./pages/ep-sede-staff/ep-sede-staff.page').then(m => m.EpSedeStaffPage),
    data: { feature: 'ep_sede_staff', level: 'staff' },
  },

  // 👇 NUEVO: gestión detallada de coordinador / encargado
  {
    path: 'ep-sede/:epSedeId/manage/:role',
    title: 'Gestionar staff · EP-Sede',
    loadComponent: () =>
      import('./pages/ep-sede-staff-manage/ep-sede-staff-manage.page')
        .then(m => m.EpSedeStaffManagePage),
    data: { feature: 'ep_sede_staff', level: 'staff_manage' },
  },

  { path: '**', redirectTo: 'ep-sede' },
];

export default ESS_ROUTES;
