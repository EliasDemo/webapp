import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserStore } from '../../state/user.store';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIf, NgClass, TranslocoPipe],
  template: `
<aside class="h-full w-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
       role="navigation" aria-label="Carril de navegación">
  <nav class="h-full flex flex-col items-center lg:items-stretch py-3 gap-2">

    <!-- Info botón + hover-card (solo cuando compact=true) -->
    <div class="group relative">
      <button type="button"
              class="w-10 h-10 grid place-items-center rounded-xl border border-gray-200 dark:border-gray-700
                     bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Información institucional">
        <i class="fas fa-circle-info text-sm"></i>
      </button>

      <div *ngIf="compact"
           class="absolute left-full top-0 ml-3 w-64 p-3 rounded-xl border border-gray-200 dark:border-gray-700
                  bg-white dark:bg-gray-900 shadow-xl hidden group-hover:block z-50">
        <div class="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-2">
          {{ 'app.institution' | transloco : { default: 'Institución' } }}
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex items-start gap-2">
            <i class="fas fa-school w-4 text-blue-600 dark:text-blue-400 mt-0.5"></i>
            <div class="min-w-0">
              <div class="text-[10px] text-gray-500 dark:text-gray-400">Universidad</div>
              <div class="font-semibold truncate">{{ universidad() || '—' }}</div>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="fas fa-map-marker-alt w-4 text-green-600 dark:text-green-400 mt-0.5"></i>
            <div class="min-w-0">
              <div class="text-[10px] text-gray-500 dark:text-gray-400">Sede</div>
              <div class="truncate">{{ sede() || '—' }}</div>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="fas fa-building w-4 text-purple-600 dark:text-purple-400 mt-0.5"></i>
            <div class="min-w-0">
              <div class="text-[10px] text-gray-500 dark:text-gray-400">Facultad</div>
              <div class="truncate">{{ facultad() || '—' }}</div>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <i class="fas fa-graduation-cap w-4 text-cyan-600 dark:text-cyan-400 mt-0.5"></i>
            <div class="min-w-0">
              <div class="text-[10px] text-gray-500 dark:text-gray-400">Escuela</div>
              <div class="truncate">{{ escuela() || '—' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Separador corto -->
    <div class="w-8 h-px bg-gray-200 dark:bg-gray-800 my-2"></div>

    <!-- Item: Dashboard -->
    <a routerLink="/dashboard"
       routerLinkActive="bg-indigo-100/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
       #rlaDash="routerLinkActive"
       (click)="itemClick.emit()"
       class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
       [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">
      <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                   bg-gradient-to-b from-indigo-500 to-purple-500
                   transition-opacity"
            [class.opacity-0]="!rlaDash.isActive"></span>

      <div class="w-10 h-10 grid place-items-center rounded-2xl"
           [ngClass]="rlaDash.isActive ? 'bg-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800'">
        <i class="fas fa-pen text-base"
           [ngClass]="rlaDash.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'"></i>
      </div>

      <span *ngIf="!compact" class="font-semibold"
            [ngClass]="rlaDash.isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'">
        Dashboard
      </span>

      <!-- Tooltip para modo compacto -->
      <div *ngIf="compact"
           class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                  opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
        Dashboard
      </div>
    </a>

    <!-- Item: Proyectos (nuevo, igual estilo que Dashboard) -->
    <a routerLink="/vm/proyectos"
       routerLinkActive="bg-indigo-100/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
       #rlaProj="routerLinkActive"
       (click)="itemClick.emit()"
       class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
       [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">
      <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                   bg-gradient-to-b from-indigo-500 to-purple-500
                   transition-opacity"
            [class.opacity-0]="!rlaProj.isActive"></span>

      <div class="w-10 h-10 grid place-items-center rounded-2xl"
           [ngClass]="rlaProj.isActive ? 'bg-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800'">
        <i class="fas fa-diagram-project text-base"
           [ngClass]="rlaProj.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'"></i>
      </div>

      <span *ngIf="!compact" class="font-semibold"
            [ngClass]="rlaProj.isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'">
        Proyectos
      </span>

      <!-- Tooltip para modo compacto -->
      <div *ngIf="compact"
           class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                  opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
        Proyectos
      </div>
    </a>

    <!-- Item: Eventos -->
    <a routerLink="/events"
      routerLinkActive="bg-amber-100/60 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
      #rlaEvents="routerLinkActive"
      (click)="itemClick.emit()"
      class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">

      <!-- Indicador activo (barra lateral) -->
      <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                  bg-gradient-to-b from-amber-500 to-orange-500 transition-opacity"
            [class.opacity-0]="!rlaEvents.isActive"></span>

      <!-- Icono -->
      <div class="w-10 h-10 grid place-items-center rounded-2xl"
          [ngClass]="rlaEvents.isActive ? 'bg-amber-500/20' : 'bg-gray-100 dark:bg-gray-800'">
        <i class="fas fa-calendar-days text-base"
          [ngClass]="rlaEvents.isActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"></i>
      </div>

      <!-- Texto -->
      <span *ngIf="!compact" class="font-semibold"
            [ngClass]="rlaEvents.isActive ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-200'">
        Eventos
      </span>

      <!-- Tooltip para modo compacto -->
      <div *ngIf="compact"
          class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                  opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
        Eventos
      </div>
    </a>


    <!-- Item: Sesiones próximas (mismo estilo que Proyectos) -->
    <a routerLink="/vm/sesiones/proximas"
      routerLinkActive="bg-sky-100/60 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300"
      #rlaUpcoming="routerLinkActive"
      (click)="itemClick.emit()"
      class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
      [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">

      <!-- Indicador activo (barra lateral) -->
      <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                  bg-gradient-to-b from-sky-500 to-cyan-500 transition-opacity"
            [class.opacity-0]="!rlaUpcoming.isActive"></span>

      <!-- Icono -->
      <div class="w-10 h-10 grid place-items-center rounded-2xl"
          [ngClass]="rlaUpcoming.isActive ? 'bg-sky-500/20' : 'bg-gray-100 dark:bg-gray-800'">
        <i class="fas fa-clock text-base"
          [ngClass]="rlaUpcoming.isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'"></i>
      </div>

      <!-- Texto -->
      <span *ngIf="!compact" class="font-semibold"
            [ngClass]="rlaUpcoming.isActive ? 'text-sky-700 dark:text-sky-300' : 'text-gray-700 dark:text-gray-200'">
        Sesiones próximas
      </span>

      <!-- Tooltip para modo compacto -->
      <div *ngIf="compact"
          class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                  opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
        Sesiones próximas
      </div>
    </a>

    <a routerLink="/mis-proyectos"
        routerLinkActive="bg-indigo-100/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
        #rlaMyProj="routerLinkActive"
        (click)="itemClick.emit()"
        class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">
        <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                    bg-gradient-to-b from-indigo-500 to-purple-500
                    transition-opacity"
              [class.opacity-0]="!rlaMyProj.isActive"></span>

        <div class="w-10 h-10 grid place-items-center rounded-2xl"
            [ngClass]="rlaMyProj.isActive ? 'bg-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800'">
          <i class="fas fa-folder-open text-base"
            [ngClass]="rlaMyProj.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'"></i>
        </div>

        <span *ngIf="!compact" class="font-semibold"
              [ngClass]="rlaMyProj.isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'">
          Mis Proyectos
        </span>

        <!-- Tooltip para modo compacto -->
        <div *ngIf="compact"
            class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                    opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
          Mis Proyectos
        </div>
      </a>


    <!-- Item: Settings -->
    <a routerLink="/settings"
        routerLinkActive="bg-indigo-100/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
        #rlaSet="routerLinkActive"
        (click)="itemClick.emit()"
        class="group relative flex items-center gap-3 rounded-2xl mx-2 px-3 py-3 text-gray-700 dark:text-gray-300
                hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        [ngClass]="{ 'justify-center': compact, 'justify-start': !compact }">
        <span class="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full
                    bg-gradient-to-b from-indigo-500 to-purple-500
                    transition-opacity"
              [class.opacity-0]="!rlaSet.isActive"></span>

        <div class="w-10 h-10 grid place-items-center rounded-2xl"
            [ngClass]="rlaSet.isActive ? 'bg-indigo-500/20' : 'bg-gray-100 dark:bg-gray-800'">
          <i class="fas fa-inbox text-base"
            [ngClass]="rlaSet.isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'"></i>
        </div>

        <span *ngIf="!compact" class="font-semibold"
              [ngClass]="rlaSet.isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-200'">
          {{ 'app.settings' | transloco }}
        </span>

        <div *ngIf="compact"
            class="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded
                    opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50">
          {{ 'app.settings' | transloco }}
        </div>
      </a>

    <div class="mt-auto"></div>
  </nav>
</aside>
  `
})
export class SidebarComponent {
  private store = inject(UserStore);

  @Input()  compact = true;              // rail compacto en desktop
  @Output() itemClick = new EventEmitter<void>();  // cerrar panel móvil al navegar

  universidad = this.store.universidad;
  sede        = this.store.sede;
  facultad    = this.store.facultad;
  escuela     = this.store.escuela;
}
