// src/app/features/misc/no-autorizado.page.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
  <div class="min-h-dvh grid place-items-center p-6">
    <div class="max-w-lg text-center">
      <h1 class="text-3xl font-extrabold mb-2">No autorizado</h1>
      <p class="text-gray-600 mb-6">
        No tienes permisos para acceder a esta sección.
      </p>
      <a routerLink="/dashboard"
         class="inline-flex items-center gap-2 rounded-lg bg-black text-white px-4 py-2">
        Volver al dashboard
      </a>
    </div>
  </div>
  `
})
export class NoAutorizadoPage {}
