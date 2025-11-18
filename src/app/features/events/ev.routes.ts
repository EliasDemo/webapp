// src/app/features/events/ev.routes.ts
import { Routes } from '@angular/router';

export const EV_ROUTES: Routes = [
  // Listado de eventos
  {
    path: '',
    loadComponent: () =>
      import('./pages/events-list/events-list.page').then(
        (m) => m.EventsListPage
      ),
    title: 'Eventos',
  },

  // Crear evento
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/event-create/event-create.page').then(
        (m) => m.EventCreatePage
      ),
    title: 'Crear evento',
  },

  // Inscritos / Candidatos de evento
  {
    path: ':id/registrantes',
    loadComponent: () =>
      import('./pages/evento-list-registrants/proyecto-list-registrants').then(
        (m) => m.EventoListRegistrantsPage
      ),
    title: 'Participantes del evento',
  },

  // Detalle de evento
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/event-detail/event-detail.page').then(
        (m) => m.EventDetailPage
      ),
    title: 'Detalle de evento',
  },
];

export default EV_ROUTES;
