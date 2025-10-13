// src/app/core/layout/shell/shell.component.ts
import {
  AfterViewInit, Component, HostListener, OnInit, ViewChild,
  DestroyRef, inject, signal
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { LoaderComponent } from '../../../shared/ui/loader/loader.component';
import { LoaderService } from '../../../shared/ui/loader/loader.service';
import { AlertCenterComponent } from '../../../shared/ui/alert/alert-center.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthApi } from '../../../features/auth/data-access/auth.api';
import { UserStore } from '../../state/user.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, NgIf, NgClass,
    LoaderComponent, AlertCenterComponent,
    TopbarComponent, SidebarComponent,
  ],
  template: `
<div class="h-dvh grid grid-rows-[auto_1fr] bg-gray-50/50 dark:bg-gray-900/50">
  <!-- Topbar -->
  <app-topbar (menuToggle)="sidebarOpen.set(true)" />

  <div class="relative flex h-full">
    <!-- Overlay móvil -->
    <div *ngIf="sidebarOpen()"
         class="fixed inset-0 z-40 bg-black/50 lg:hidden"
         (click)="sidebarOpen.set(false)"></div>

    <!-- Rail compacto (desktop) -->
    <aside class="hidden lg:flex w-16 shrink-0" id="app-sidebar">
      <app-sidebar [compact]="true" (itemClick)="noop()" />
    </aside>

    <!-- Panel móvil (expandido) -->
    <aside id="app-sidebar-mobile"
           class="lg:hidden fixed inset-y-0 left-0 z-50 w-72 will-change-transform
                  transform transition-transform duration-300 ease-in-out
                  border-r border-gray-200 dark:border-gray-800
                  bg-white dark:bg-gray-900"
           [ngClass]="sidebarOpen() ? 'translate-x-0' : '-translate-x-full'">
      <app-sidebar [compact]="false" (itemClick)="sidebarOpen.set(false)" />
    </aside>

    <!-- Contenido -->
    <main class="flex-1 min-w-0 overflow-auto">
      <div class="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
        <router-outlet />
      </div>
    </main>
  </div>
</div>

<app-loader />
<app-alert-center />
  `,
})
export class ShellComponent implements OnInit, AfterViewInit {
  @ViewChild(LoaderComponent) loader!: LoaderComponent;

  private loaderSvc = inject(LoaderService);
  private auth = inject(AuthApi);
  private userStore = inject(UserStore);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  sidebarOpen = signal(false);

  ngOnInit(): void {
    if (this.auth.session().token) this.userStore.loadMe();
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.sidebarOpen.set(false));
  }

  ngAfterViewInit() { this.loaderSvc.register(this.loader); }

  @HostListener('document:keydown.escape')
  onEscape() { this.sidebarOpen.set(false); }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.sidebarOpen()) return;
    const el = ev.target as HTMLElement;
    const clickedInside = !!el.closest('#app-sidebar-mobile') || !!el.closest('app-topbar');
    if (!clickedInside) this.sidebarOpen.set(false);
  }

  noop() {}
}
