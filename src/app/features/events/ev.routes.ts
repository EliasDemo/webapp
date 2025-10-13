import { Routes } from '@angular/router';

export const EV_ROUTES: Routes = [
  // Listado de eventos
  {
    path: '',
    loadComponent: () =>
      import('./pages/events-list/events-list.page').then(m => m.EventsListPage),
    title: 'Eventos',
  },

  // Crear evento (cuando tengas el componente listo)
   {
     path: 'new',
     loadComponent: () =>
       import('./pages/event-create/event-create.page').then(m => m.EventCreatePage),
     title: 'Crear evento',
   },

  // Detalle/editar evento (cuando tengas el componente listo)
  // {
  //   path: ':id',
  //   loadComponent: () =>
  //     import('./pages/event-detail/event-detail.page').then(m => m.EventDetailPage),
  //   title: 'Detalle de evento',
  // },
];

export default EV_ROUTES;
