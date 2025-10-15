// src/app/core/layout/shell/shell.component.ts
import {
  AfterViewInit, Component, HostListener, OnInit, ViewChild,
  DestroyRef, inject, signal, computed
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

// 👇 importar el banner
import { WelcomeFooterComponent } from '../footer/welcome-footer.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, NgIf,
    LoaderComponent, AlertCenterComponent,
    TopbarComponent, SidebarComponent,
    // 👇 añadir el componente del footer
    WelcomeFooterComponent,
  ],
  template: `
<!-- Layout Principal - Uso Optimizado de Pantalla -->
<div class="h-dvh grid grid-rows-[auto_1fr] bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/10 dark:from-gray-900 dark:via-blue-900/10 dark:to-purple-900/10">

  <!-- Topbar Mejorado -->
  <app-topbar (menuToggle)="sidebarOpen.set(true)"
              [class.sidebar-expanded]="sidebarExpanded()" />

  <div class="relative flex h-full overflow-hidden">
    <!-- Overlay móvil mejorado -->
    <div *ngIf="sidebarOpen() && isMobile()"
         class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all duration-300 lg:hidden"
         (click)="sidebarOpen.set(false)"></div>

    <!-- Sidebar Desktop - Rediseñado -->
    <aside class="hidden lg:flex h-full transition-all duration-300 ease-in-out bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-r border-gray-200/50 dark:border-gray-700/50 shadow-xl"
           [class.w-72]="sidebarExpanded()"
           [class.w-20]="!sidebarExpanded()"
           id="app-sidebar">
      <app-sidebar [compact]="!sidebarExpanded()"
                   (itemClick)="onSidebarItemClick()"
                   (toggleExpand)="sidebarExpanded.set(!sidebarExpanded())" />
    </aside>

    <!-- Sidebar Mobile - Mejorado -->
    <aside id="app-sidebar-mobile"
           class="lg:hidden fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] will-change-transform
                  transform transition-all duration-300 ease-out
                  border-r border-gray-200 dark:border-gray-800
                  bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl"
           [class.translate-x-0]="sidebarOpen()"
           [class.-translate-x-full]="!sidebarOpen()">
      <app-sidebar [compact]="false"
                   (itemClick)="sidebarOpen.set(false)"
                   [showToggle]="false" />
    </aside>

    <!-- Área de Contenido Principal - Optimizada -->
    <main class="flex-1 min-w-0 h-full overflow-auto bg-transparent">
      <!-- Container adaptable -->
      <div class="h-full w-full" [class]="containerClass()">
        <router-outlet />
      </div>
    </main>

    <!-- Toggle Button para Sidebar Desktop -->
    <button *ngIf="!isMobile()"
            class="hidden lg:flex fixed left-4 bottom-4 z-30 w-10 h-10 items-center justify-center
                   rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50
                   shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 hover:bg-white dark:hover:bg-gray-800
                   text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
            (click)="sidebarExpanded.set(!sidebarExpanded())"
            [title]="sidebarExpanded() ? 'Contraer sidebar' : 'Expandir sidebar'">
      <i class="fa-solid" [class.fa-chevron-left]="sidebarExpanded()" [class.fa-chevron-right]="!sidebarExpanded()"></i>
    </button>
  </div>
</div>

<!-- 👇 Banner de bienvenida (aparece y se esconde solo) -->
<app-welcome-footer [autoShow]="true" [duration]="5000"></app-welcome-footer>


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
  sidebarExpanded = signal(true);
  screenWidth = signal(window.innerWidth);

  // Computed properties para responsividad
  isMobile = computed(() => this.screenWidth() < 1024);
  containerClass = computed(() =>
    this.sidebarExpanded() && !this.isMobile()
      ? 'max-w-full px-4 sm:px-6 lg:px-8 py-4'
      : 'max-w-full px-4 sm:px-6 lg:px-8 py-4'
  );

  ngOnInit(): void {
    if (this.auth.session().token) this.userStore.loadMe();

    // Cerrar sidebar en navegación
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.isMobile()) {
          this.sidebarOpen.set(false);
        }
      });

    // Trackear tamaño de pantalla
    this.updateScreenWidth();
  }

  ngAfterViewInit() {
    this.loaderSvc.register(this.loader);
  }

  @HostListener('window:resize')
  onResize() {
    this.updateScreenWidth();

    // Auto-colapsar sidebar en móvil
    if (!this.isMobile() && this.sidebarOpen()) {
      this.sidebarOpen.set(false);
    }

    // Auto-expandir sidebar cuando se cambia a desktop
    if (!this.isMobile() && !this.sidebarExpanded()) {
      this.sidebarExpanded.set(true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.sidebarOpen() || !this.isMobile()) return;

    const el = ev.target as HTMLElement;
    const clickedInside = !!el.closest('#app-sidebar-mobile') || !!el.closest('app-topbar');

    if (!clickedInside) {
      this.sidebarOpen.set(false);
    }
  }

  private updateScreenWidth() {
    this.screenWidth.set(window.innerWidth);
  }

  onSidebarItemClick() {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }
}
