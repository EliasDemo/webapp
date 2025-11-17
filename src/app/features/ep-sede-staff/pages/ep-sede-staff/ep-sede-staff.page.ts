import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EpSedeStaffApiService } from '../../data-access/ep-sede-staff-api.service';
import {
  ApiResponse,
  EpSedeStaffContextPayload,
  EpSedeStaffCurrentPayload,
  EpSedeStaffHistoryItem,
  EpSedeStaffHistoryPayload,
  EpSedeStaffUnassignInput,
  StaffRole,
  StaffUserStatus,
  StaffEvento,
} from '../../models/ep-sede-staff.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service'; // 👈 NUEVO

@Component({
  standalone: true,
  selector: 'app-ep-sede-staff-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ep-sede-staff.page.html',
})
export class EpSedeStaffPage implements OnInit {
  // -------------------------
  // Inyección de dependencias
  // -------------------------

  private readonly api = inject(EpSedeStaffApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loader = inject(LoaderService); // 👈 NUEVO

  // -------------------------
  // Contexto del usuario (backend /ep-sedes/staff/context)
  // -------------------------

  readonly context = signal<EpSedeStaffContextPayload | null>(null);
  readonly contextLoading = signal(false);

  /** Permisos derivados del contexto */
  readonly canManageCoordinador = computed(
    () => !!this.context()?.can_manage_coordinador
  );

  readonly canManageEncargado = computed(
    () => !!this.context()?.can_manage_encargado
  );

  /** Modo "admin-like" en el panel */
  readonly isAdmin = computed(() => this.context()?.panel_mode === 'ADMIN');

  /** Modo "coordinador" (solo encargados) */
  readonly isCoordinator = computed(
    () => this.context()?.panel_mode === 'COORDINADOR'
  );

  /** Lista de EP-Sedes visibles para el usuario (para el selector de admin) */
  readonly epSedes = computed(() => this.context()?.ep_sedes ?? []);

  /** Label de la EP-Sede actual (si está en la lista del contexto) */
  readonly currentEpSedeLabel = computed(() => {
    const id = this.epSedeId();
    if (!id) return null;
    const ep = this.epSedes().find((e) => e.id === id);
    return ep?.label ?? null;
  });

  // -------------------------
  // Estado básico de la pantalla
  // -------------------------

  readonly epSedeId = signal<number | null>(null);
  readonly epSedeIdInput = signal<number | null>(null);
  private routeEpSedeId: number | null = null;

  readonly loadingCurrent = signal(false);
  readonly loadingHistory = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly currentPayload = signal<EpSedeStaffCurrentPayload | null>(null);
  readonly historyPayload = signal<EpSedeStaffHistoryPayload | null>(null);

  // Derivados
  readonly staff = computed(() => this.currentPayload()?.staff ?? null);
  readonly history = computed<EpSedeStaffHistoryItem[]>(
    () => this.historyPayload()?.history ?? []
  );
  readonly hasData = computed(
    () => !!this.staff() || this.history().length > 0
  );

  // -------------------------
  // Diálogo de desasignación
  // -------------------------

  unassignRole: StaffRole | null = null;
  unassignMotivo = '';
  unassignSubmitting = false;

  get unassignDialogOpen(): boolean {
    return this.unassignRole !== null;
  }

  // -------------------------
  // Ciclo de vida
  // -------------------------

  ngOnInit(): void {
    // Escuchar cambios en la URL (:epSedeId)
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pm) => {
        const raw = pm.get('epSedeId');
        const urlNum = raw ? Number(raw) : NaN;
        this.routeEpSedeId =
          Number.isFinite(urlNum) && urlNum > 0 ? urlNum : null;

        this.resolveEpSedeFromContextAndRoute();
      });

    // Cargar contexto desde backend
    void this.loadContext();
  }

  // -------------------------
  // Contexto (backend)
  // -------------------------

  private async loadContext(): Promise<void> {
    this.contextLoading.set(true);
    this.loader.show('Cargando contexto de staff...'); // 👈 usa loader global
    try {
      const res = await firstValueFrom(this.api.obtenerContextoPanel());

      if (res.ok) {
        this.context.set(res.data);
      } else {
        this.context.set(null);
        this.errorMsg.set(
          res.message || 'No se pudo obtener el contexto de staff.'
        );
      }
    } catch (e: unknown) {
      console.error(e);
      const message =
        e instanceof Error
          ? e.message
          : 'No se pudo obtener el contexto de staff.';
      this.context.set(null);
      this.errorMsg.set(message);
    } finally {
      this.contextLoading.set(false);
      this.loader.hide(); // 👈 cierre garantizado
      this.resolveEpSedeFromContextAndRoute();
    }
  }

  /**
   * Decide qué EP-Sede usar combinando contexto + URL:
   *  - Si NO es admin-like → EP-Sede fija desde contexto (ep_sede_id).
   *  - Si es admin-like → usa :epSedeId o ep_sede_id (si existiera).
   *  - Si es admin y no hay nada → queda null y se muestra el selector.
   */
  private resolveEpSedeFromContextAndRoute(): void {
    const ctx = this.context();
    const routeId = this.routeEpSedeId;

    // Si aún se está cargando contexto y no hay nada, esperamos
    if (!ctx && this.contextLoading()) {
      return;
    }

    let finalId: number | null = null;

    if (ctx) {
      const defaultFromCtx = ctx.ep_sede_id;
      const adminLike = this.isAdmin();

      if (!adminLike) {
        // Coordinador / modo limitado: EP-Sede fija del contexto
        finalId = defaultFromCtx;
      } else {
        // Admin-like: usa URL si viene, si no ep_sede_id (que normalmente será null)
        finalId = routeId ?? defaultFromCtx;
      }
    } else {
      // Sin contexto (fallback raro): solo URL
      finalId = routeId ?? null;
    }

    const previous = this.epSedeId();
    this.epSedeId.set(finalId);

    if (finalId) {
      this.epSedeIdInput.set(finalId);
      // Evitar recargar si ya estamos en la misma EP-Sede y ya hay datos
      if (previous !== finalId || !this.currentPayload()) {
        void this.reloadAll();
      }
    } else {
      this.epSedeIdInput.set(null);
      this.currentPayload.set(null);
      this.historyPayload.set(null);
    }
  }

  // -------------------------
  // Carga de datos
  // -------------------------

  async reloadAll(): Promise<void> {
    const id = this.epSedeId();
    if (!id) return;

    this.errorMsg.set(null);
    this.loadingCurrent.set(true);
    this.loadingHistory.set(true);
    this.loader.show('Cargando información de staff...'); // 👈 loader global

    try {
      const [currentRes, historyRes]: [
        ApiResponse<EpSedeStaffCurrentPayload>,
        ApiResponse<EpSedeStaffHistoryPayload>
      ] = await Promise.all([
        firstValueFrom(this.api.obtenerStaffActual(id)),
        firstValueFrom(this.api.obtenerHistorialStaff(id)),
      ]);

      if (currentRes.ok) {
        this.currentPayload.set(currentRes.data);
      } else {
        this.currentPayload.set(null);
        this.errorMsg.set(
          currentRes.message || 'Error al cargar el staff actual.'
        );
      }

      if (historyRes.ok) {
        this.historyPayload.set(historyRes.data);
      } else {
        this.historyPayload.set(null);
        if (!this.errorMsg()) {
          this.errorMsg.set(
            historyRes.message || 'Error al cargar el historial.'
          );
        }
      }
    } catch (e: unknown) {
      console.error(e);
      const message =
        e instanceof Error
          ? e.message
          : 'No se pudo cargar la información de staff.';
      this.errorMsg.set(message);
      this.currentPayload.set(null);
      this.historyPayload.set(null);
    } finally {
      this.loadingCurrent.set(false);
      this.loadingHistory.set(false);
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  // -------------------------
  // Navegación por EP-Sede (selector / input)
  // -------------------------

  /** Selección desde el combo de EP-Sedes (solo ADMIN-like). */
  onSelectEpSedeFromList(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!value) return;

    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return;

    this.errorMsg.set(null);
    this.router.navigate(['/staff/ep-sede', id]);
  }

  /** Navegar usando el input numérico. */
  goToEpSedeFromInput(): void {
    if (!this.isAdmin()) {
      this.errorMsg.set(
        'Como coordinador solo puedes gestionar la EP-Sede asignada en tu sesión.'
      );
      return;
    }

    const value = this.epSedeIdInput();

    if (value == null) {
      this.errorMsg.set('Ingresa un ID de EP-Sede.');
      return;
    }

    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMsg.set('Ingresa un ID de EP-Sede válido.');
      return;
    }

    this.errorMsg.set(null);
    this.router.navigate(['/staff/ep-sede', id]);
  }

  // -------------------------
  // Desasignar staff (modal)
  // -------------------------

  openUnassign(role: StaffRole): void {
    // Solo quien puede gestionar coordinadores puede desasignar COORDINADOR
    if (!this.canManageCoordinador() && role === 'COORDINADOR') {
      this.errorMsg.set('No estás autorizado para desasignar al coordinador.');
      return;
    }

    this.unassignRole = role;
    this.unassignMotivo = '';
    this.errorMsg.set(null);
  }

  cancelUnassign(): void {
    if (this.unassignSubmitting) return;
    this.unassignRole = null;
    this.unassignMotivo = '';
  }

  async confirmUnassign(): Promise<void> {
    const epSedeId = this.epSedeId();
    const role = this.unassignRole;

    if (!epSedeId || !role) return;

    const body: EpSedeStaffUnassignInput = {
      role,
      motivo: this.unassignMotivo.trim() || undefined,
    };

    this.unassignSubmitting = true;
    this.loadingCurrent.set(true);
    this.errorMsg.set(null);
    this.loader.show('Desasignando staff...'); // 👈 loader global

    try {
      const res = await firstValueFrom(
        this.api.desasignarStaff(epSedeId, body)
      );

      if (res.ok) {
        this.cancelUnassign();
        await this.reloadAll();
      } else {
        this.errorMsg.set(res.message || 'Error al desasignar staff.');
      }
    } catch (e: unknown) {
      console.error(e);
      const message =
        e instanceof Error ? e.message : 'Error al desasignar staff.';
      this.errorMsg.set(message);
    } finally {
      this.unassignSubmitting = false;
      this.loadingCurrent.set(false);
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  // -------------------------
  // Helpers de presentación
  // -------------------------

  formatStatus(status: StaffUserStatus | null | undefined): string {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'view_only':
        return 'Solo lectura';
      case 'suspended':
        return 'Suspendido';
      default:
        return '—';
    }
  }

  formatEvento(evento: StaffEvento): string {
    switch (evento) {
      case 'ASSIGN':
        return 'Asignación';
      case 'UNASSIGN':
        return 'Desasignación';
      case 'REINSTATE':
        return 'Reincorporación';
      case 'DELEGATE':
        return 'Delegación interina';
      case 'AUTO_END':
        return 'Fin automático';
      case 'TRANSFER':
        return 'Transferencia';
      default:
        return evento;
    }
  }

  trackHistory = (_: number, item: EpSedeStaffHistoryItem) => item.id;
}
