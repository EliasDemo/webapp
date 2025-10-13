// src/app/core/layout/topbar/topbar.component.ts
import {
  Component, ElementRef, EventEmitter, HostListener, Output, inject, signal
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserStore } from '../../state/user.store';
import { AuthApi } from '../../../features/auth/data-access/auth.api';
import { AlertService } from '../../../shared/ui/alert/alert.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [NgIf, NgClass, RouterLink, TranslocoPipe],
  template: `
<nav class="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 backdrop-blur">
  <div class="mx-auto max-w-screen-2xl px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
    <!-- Brand -->
    <a routerLink="/" class="flex items-center gap-3 group" aria-label="Inicio">
      <div class="relative">
        <div class="absolute inset-0 rounded-xl blur-md bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-600 opacity-60"></div>
        <div class="relative p-2 rounded-xl bg-gradient-to-br from-blue-700 to-purple-700 border border-blue-500/30 shadow">
          <img *ngIf="logoOk(); else logoText" src="assets/logo.svg" class="h-6 w-auto block" alt="Logo" (error)="logoOk.set(false)">
        </div>
      </div>
      <ng-template #logoText>
        <span class="text-lg font-extrabold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 dark:from-white dark:via-blue-100 dark:to-purple-100 bg-clip-text text-transparent">
          Webapp
        </span>
      </ng-template>
      <span class="hidden sm:block text-[10px] lg:text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wide">
        ACADEMIC PLATFORM
      </span>
    </a>

    <div class="flex items-center gap-2 lg:gap-4">
      <!-- Estado -->
      <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">En línea</span>
        <span class="mx-2 w-px h-4 bg-gray-300 dark:bg-gray-600"></span>
        <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ status() || 'ACTIVO' }}</span>
      </div>

      <!-- Abrir rail (móvil) -->
      <button type="button"
              class="lg:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
              (click)="menuToggle.emit()"
              aria-label="Abrir menú lateral" aria-controls="app-sidebar-mobile" aria-expanded="false">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <!-- User menu -->
      <div class="relative">
        <button type="button"
                class="flex items-center gap-2 p-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700"
                (click)="toggleMenu()" aria-haspopup="menu" [attr.aria-expanded]="open()" aria-controls="user-menu">
          <div class="relative">
            <img *ngIf="photo(); else placeholder" [src]="photo()!" class="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-gray-900 shadow" alt="Foto de perfil">
            <ng-template #placeholder>
              <div class="w-9 h-9 grid place-items-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 text-white font-bold text-xs border-2 border-white dark:border-gray-900">{{ initials() }}</div>
            </ng-template>
            <span class="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-500 border border-white dark:border-gray-900"></span>
          </div>
          <div class="hidden lg:block text-left max-w-40">
            <div class="text-sm font-bold truncate text-gray-900 dark:text-gray-100">{{ name() || 'Usuario' }}</div>
            <div class="text-xs truncate text-gray-600 dark:text-gray-400">{{ email() || '—' }}</div>
          </div>
          <svg class="hidden lg:block w-4 h-4 text-gray-500 transition-transform" [class.rotate-180]="open()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <div *ngIf="open()" id="user-menu"
             class="absolute right-0 mt-2 w-80 lg:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50"
             role="menu" aria-label="Menú de usuario">
          <div class="p-5 border-b border-gray-200 dark:border-gray-800">
            <div class="flex items-center gap-4">
              <img *ngIf="photo(); else mini" [src]="photo()!" class="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-900 shadow" alt="Foto de perfil">
              <ng-template #mini>
                <div class="w-14 h-14 grid place-items-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 text-white font-bold text-lg border-2 border-white dark:border-gray-900">{{ initials() }}</div>
              </ng-template>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-extrabold truncate text-gray-900 dark:text-gray-100">{{ name() || '—' }}</h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                        [ngClass]="{ 'bg-emerald-600 text-white': status() === 'ACTIVO', 'bg-gray-600 text-white': status() !== 'ACTIVO' }">
                    {{ status() || '—' }}
                  </span>
                </div>
                <p class="text-sm truncate text-gray-600 dark:text-gray-400">{{ email() || '—' }}</p>
              </div>
            </div>
          </div>
          <ul class="py-2" role="none">
            <li role="none">
              <a routerLink="/dashboard" (click)="open.set(false)"
                 class="flex items-center gap-3 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 border-l-4 border-transparent hover:border-blue-500 transition"
                 role="menuitem">
                <span class="flex-1">Dashboard principal</span>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </a>
            </li>
            <li role="none">
              <a routerLink="/settings" (click)="open.set(false)"
                 class="flex items-center gap-3 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-blue-50/70 dark:hover:bg-blue-900/30 border-l-4 border-transparent hover:border-blue-500 transition"
                 role="menuitem">
                <span class="flex-1">{{ 'app.settings' | transloco }}</span>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
              </a>
            </li>
          </ul>
          <div class="p-4 border-t border-gray-200 dark:border-gray-800 bg-red-50/60 dark:bg-red-900/10">
            <button type="button" (click)="logout()"
                    class="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold text-white rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 transition"
                    role="menuitem">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</nav>
  `,
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private el = inject(ElementRef);
  private router = inject(Router);
  private alerts = inject(AlertService);
  private auth = inject(AuthApi);
  private userStore = inject(UserStore);

  open   = signal(false);
  logoOk = signal(true);

  name   = this.userStore.name;
  email  = this.userStore.email;
  photo  = this.userStore.photo;
  status = this.userStore.status;

  initials() {
    const n = this.name(); if (!n) return 'U';
    const p = n.trim().split(/\s+/);
    return (p[0]?.[0] ?? 'U') + (p[1]?.[0] ?? '');
  }

  toggleMenu() { this.open.set(!this.open()); }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.el.nativeElement.contains(ev.target)) this.open.set(false);
  }
  @HostListener('document:keydown.escape') onEsc() { this.open.set(false); }

  logout() {
    this.auth.logout().subscribe({
      next: () => { this.alerts.success('Sesión cerrada correctamente'); this.userStore.clear(); this.router.navigateByUrl('/auth/login'); },
      error: () => { this.userStore.clear(); this.router.navigateByUrl('/auth/login'); }
    });
  }
}
