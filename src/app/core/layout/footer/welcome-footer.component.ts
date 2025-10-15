import {
  Component, inject, signal, OnInit, OnDestroy, effect,
  ChangeDetectionStrategy, HostListener, PLATFORM_ID,
  booleanAttribute, numberAttribute, Input
} from '@angular/core';
import { NgIf, NgClass, isPlatformBrowser } from '@angular/common';
import { FooterToastService, ToastConfig, ToastType } from './footer-toast.service';

@Component({
  selector: 'app-welcome-footer',
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: './welcome-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeFooterComponent implements OnInit, OnDestroy {
  private toast = inject(FooterToastService);
  private platformId = inject(PLATFORM_ID);

  // Auto-show opcional (útil para bienvenida)
  @Input({ transform: booleanAttribute }) autoShow = false;
  @Input({ transform: numberAttribute }) duration = 5000;
  @Input() message?: string;
  @Input() type: ToastType = 'welcome';

  // Señales del servicio
  visible  = this.toast.visible;
  text     = this.toast.text;
  icon     = this.toast.icon;
  action   = this.toast.action;
  toastType = this.toast.type; // evita colisión con @Input() type

  // UI
  reduceMotion  = signal(false);
  progressWidth = signal(100);

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private mq: MediaQueryList | null = null;
  private mqHandler = (e: MediaQueryListEvent) => this.reduceMotion.set(!!e.matches);

  // Efecto: cuando cambia visible() o reduceMotion(), gestiona la barra
  private visibilityEffect = effect(() => {
    const isVisible = this.visible();
    if (isPlatformBrowser(this.platformId) && isVisible && !this.reduceMotion()) {
      this.startProgressBar();
    } else {
      this.stopProgressBar();
    }
  });

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Auto show si se pide desde el template
    if (this.autoShow) {
      const config: ToastConfig = {
        duration: this.duration,
        text: this.message,
        type: this.type
      };
      this.toast.show(config);
    }

    // Media query: reduced motion
    this.setupReducedMotion();
  }

  ngOnDestroy() {
    this.cleanupMediaQuery();
    this.stopProgressBar();
  }

  private setupReducedMotion() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduceMotion.set(!!this.mq.matches);
      ('addEventListener' in this.mq)
        ? this.mq.addEventListener('change', this.mqHandler)
        : (this.mq as any).addListener?.(this.mqHandler);
    }
  }

  private cleanupMediaQuery() {
    if (!this.mq) return;
    ('removeEventListener' in this.mq)
      ? this.mq.removeEventListener('change', this.mqHandler)
      : (this.mq as any).removeListener?.(this.mqHandler);
  }

  private startProgressBar() {
    this.progressWidth.set(100);
    this.stopProgressBar(); // limpia intervalos anteriores

    const startTime = Date.now();
    const duration = this.toast.duration(); // usa la duración real del toast

    this.progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      this.progressWidth.set(remaining);
      if (remaining <= 0) this.stopProgressBar();
    }, 50);
  }

  private stopProgressBar() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  // ---- clases dinámicas (usar corchetes para evitar TS4111) ----
  getStatusBarClass(): string {
    const type = this.toastType();
    const classes = {
      welcome: 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500',
      success: 'bg-gradient-to-r from-green-500 to-emerald-500',
      error:   'bg-gradient-to-r from-red-500   to-rose-500',
      warning: 'bg-gradient-to-r from-amber-500 to-orange-500',
      info:    'bg-gradient-to-r from-blue-500  to-cyan-500'
    } as const;
    return classes[type] || classes['welcome'];
  }

  getIconContainerClass(): string {
    const type = this.toastType();
    const classes = {
      welcome: 'bg-gradient-to-br from-indigo-600 to-cyan-600',
      success: 'bg-gradient-to-br from-green-600 to-emerald-600',
      error:   'bg-gradient-to-br from-red-600   to-rose-600',
      warning: 'bg-gradient-to-br from-amber-600 to-orange-600',
      info:    'bg-gradient-to-br from-blue-600  to-cyan-600'
    } as const;
    return classes[type] || classes['welcome'];
  }

  getTextGradientClass(): string {
    const type = this.toastType();
    const classes = {
      welcome: 'bg-gradient-to-r from-indigo-700 to-emerald-700 dark:from-indigo-300 dark:to-emerald-300',
      success: 'bg-gradient-to-r from-green-700 to-emerald-700 dark:from-green-300 dark:to-emerald-300',
      error:   'bg-gradient-to-r from-red-700   to-rose-700   dark:from-red-300   dark:to-rose-300',
      warning: 'bg-gradient-to-r from-amber-700 to-orange-700 dark:from-amber-300 dark:to-orange-300',
      info:    'bg-gradient-to-r from-blue-700  to-cyan-700  dark:from-blue-300  to-cyan-300'
    } as const;
    return `bg-clip-text text-transparent ${classes[type] || classes['welcome']}`;
  }

  getProgressBarClass(): string {
    const type = this.toastType();
    const classes = {
      welcome: 'bg-gradient-to-r from-indigo-500 to-cyan-500',
      success: 'bg-gradient-to-r from-green-500 to-emerald-500',
      error:   'bg-gradient-to-r from-red-500   to-rose-500',
      warning: 'bg-gradient-to-r from-amber-500 to-orange-500',
      info:    'bg-gradient-to-r from-blue-500  to-cyan-500'
    } as const;
    return classes[type] || classes['welcome'];
  }

  getSubtitle(): string {
    const type = this.toastType();
    const subtitles = {
      welcome: 'Aparece al iniciar sesión y se cerrará automáticamente.',
      success: 'Operación completada correctamente.',
      error:   'Ha ocurrido un error. Por favor, inténtalo de nuevo.',
      warning: 'Atención: Esta acción requiere tu confirmación.',
      info:    'Información importante para tu consideración.'
    } as const;
    return subtitles[type] || subtitles['welcome'];
  }

  handleAction() {
    const currentAction = this.action();
    if (currentAction) {
      currentAction.callback();
      this.close();
    }
  }

  close() {
    this.toast.hide();
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.visible()) this.close();
  }
}
