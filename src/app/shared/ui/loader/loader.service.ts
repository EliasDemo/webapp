// shared/ui/loader/loader.service.ts
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly DEFAULT_MESSAGE = 'Procesando solicitud...';
  private readonly MAX_VISIBLE_MS = 45000; // 45s de seguridad

  // Estado interno con signals
  private _visible = signal(false);
  private _message = signal<string>(this.DEFAULT_MESSAGE);
  private _progress = signal(0); // 0-100

  private activeRequests = 0;
  private messagesStack: string[] = [];
  private progressInterval?: any;
  private watchdogTimeout?: any;

  // Signals de solo lectura para los componentes
  readonly visible = this._visible.asReadonly();
  readonly message = this._message.asReadonly();
  readonly progress = this._progress.asReadonly();

  /**
   * Muestra el loader global.
   */
  show(message?: string): void {
    this.activeRequests++;

    if (message) {
      this.messagesStack.push(message);
      this._message.set(message);
    } else if (!this.messagesStack.length) {
      this._message.set(this.DEFAULT_MESSAGE);
    } else {
      this._message.set(this.messagesStack[this.messagesStack.length - 1]);
    }

    if (!this._visible()) {
      this._visible.set(true);
    }

    this._progress.set(0);
    this.startProgressSimulation();
    this.startWatchdog();
  }

  /**
   * Oculta el loader. Si force=true, limpia toda la cola.
   */
  hide(force = false): void {
    if (force) {
      this.activeRequests = 0;
      this.messagesStack = [];
    } else if (this.activeRequests > 0) {
      this.activeRequests--;
      if (this.messagesStack.length) {
        this.messagesStack.pop();
      }
    }

    if (this.activeRequests === 0) {
      // Completar barra y luego ocultar
      this._progress.set(100);
      this.clearWatchdog();
      this.stopProgressSimulation();

      setTimeout(() => {
        this._visible.set(false);
        this._progress.set(0);
        this._message.set(this.DEFAULT_MESSAGE);
      }, 250);
    } else {
      const lastMsg = this.messagesStack[this.messagesStack.length - 1] ?? this.DEFAULT_MESSAGE;
      this._message.set(lastMsg);
    }
  }

  /**
   * Permite fijar el progreso manualmente (0-100).
   */
  setProgress(value: number): void {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    this._progress.set(clamped);
  }

  /**
   * Helper para envolver peticiones RxJS y NO olvidarse nunca del hide().
   */
  track<T>(obs$: Observable<T>, message?: string): Observable<T> {
    this.show(message);
    return obs$.pipe(
      finalize(() => this.hide())
    );
  }

  /**
   * Reset duro (por ejemplo al cerrar sesión).
   */
  reset(): void {
    this.activeRequests = 0;
    this.messagesStack = [];
    this.clearWatchdog();
    this.stopProgressSimulation();
    this._visible.set(false);
    this._progress.set(0);
    this._message.set(this.DEFAULT_MESSAGE);
  }

  /**
   * API antigua: la dejamos por compatibilidad.
   * Ya no hace falta registrar el componente explícitamente.
   */
  register(_loader: unknown): void {
    // no-op (antes se usaba para guardar la instancia del componente)
  }

  /**
   * API antigua usada en el componente: devolvemos el signal.
   */
  getProgress() {
    return this.progress;
  }

  // ─────────────────────────────
  // Lógica interna
  // ─────────────────────────────
  private startProgressSimulation(): void {
    if (this.progressInterval) return;

    this.progressInterval = setInterval(() => {
      const current = this._progress();
      if (current >= 90) return;

      // Incremento no lineal para sensación de "cargando"
      const increment = Math.max(1, Math.round((100 - current) * 0.07));
      this._progress.set(current + increment);
    }, 400);
  }

  private stopProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }

  /**
   * Watchdog: si algo se olvidó del hide(), el loader NO se queda eterno.
   */
  private startWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimeout = setTimeout(() => {
      if (this._visible()) {
        console.warn('[LoaderService] Auto-hide del loader por timeout');
        this.hide(true);
      }
    }, this.MAX_VISIBLE_MS);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = undefined;
    }
  }
}
