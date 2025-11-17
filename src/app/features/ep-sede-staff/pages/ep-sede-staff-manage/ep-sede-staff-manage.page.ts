// src/app/features/ep-sede-staff/pages/ep-sede-staff-manage/ep-sede-staff-manage.page.ts
import {
  Component,
  OnInit,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { EpSedeStaffApiService } from '../../data-access/ep-sede-staff-api.service';
import {
  EpSedeStaffAssignInput,
  EpSedeStaffContextPayload,
  EpSedeStaffCreateAndAssignInput,
  EpSedeStaffDelegateInput,
  EpSedeStaffLookupPayload,
  StaffRole,
} from '../../models/ep-sede-staff.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service'; // 👈 NUEVO

@Component({
  standalone: true,
  selector: 'app-ep-sede-staff-manage-page',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './ep-sede-staff-manage.page.html',
})
export class EpSedeStaffManagePage implements OnInit {
  private api = inject(EpSedeStaffApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private loader = inject(LoaderService);     // 👈 NUEVO
  private destroyRef = inject(DestroyRef);    // 👈 NUEVO

  epSedeId: number | null = null;
  role: StaffRole = 'COORDINADOR';   // COORDINADOR | ENCARGADO
  spatieRole = 'COORDINADOR';       // Rol para Spatie/Spatie-Permission

  // Contexto de staff (para permisos)
  context: EpSedeStaffContextPayload | null = null;
  contextLoading = false;
  private routeReady = false;

  // Estado UI
  loadingLookup = false;
  loadingAssign = false;
  loadingCreate = false;
  loadingDelegate = false;

  errorMsg: string | null = null;
  successMsg: string | null = null;

  // Datos de lookup
  lookup: EpSedeStaffLookupPayload | null = null;

  // Formularios reactivos
  searchForm: FormGroup;
  assignForm: FormGroup;
  createForm: FormGroup;
  delegateForm: FormGroup;

  // Tabs: existing | new | delegate
  selectedTab: 'existing' | 'new' | 'delegate' = 'existing';

  constructor() {
    const today = new Date().toISOString().slice(0, 10);

    // Buscar por correo
    this.searchForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    // Asignar existente
    this.assignForm = this.fb.group({
      vigente_desde: [today],
      motivo: [''],
    });

    // Crear nuevo + asignar
    this.createForm = this.fb.group({
      username: ['', Validators.required],
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      doc_tipo: [''],
      doc_numero: ['', Validators.required], // requerido, coincide con backend
      celular: [''],
      pais: [''],
      vigente_desde: [today],
      motivo: [''],
      correo_institucional: [''],
    });

    // Delegar encargado interino
    this.delegateForm = this.fb.group({
      user_id: ['', Validators.required],
      desde: [today, Validators.required],
      hasta: ['', Validators.required],
      motivo: [''],
    });
  }

  get roleLabel(): string {
    return this.role === 'COORDINADOR' ? 'Coordinador' : 'Encargado';
  }

  get isEncargado(): boolean {
    return this.role === 'ENCARGADO';
  }

  // Permisos derivados del contexto
  get canManageCoordinador(): boolean {
    const ctx = this.context;
    return !!ctx?.can_manage_coordinador;
  }

  get canManageEncargado(): boolean {
    const ctx = this.context;
    return !!ctx?.can_manage_encargado;
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((pm) => {
        const epIdRaw = pm.get('epSedeId');
        const roleRaw = (pm.get('role') || '').toUpperCase();

        const num = epIdRaw ? Number(epIdRaw) : NaN;
        this.epSedeId = Number.isFinite(num) && num > 0 ? num : null;

        this.role = roleRaw === 'ENCARGADO' ? 'ENCARGADO' : 'COORDINADOR';
        this.spatieRole = this.role; // Por defecto, igual al rol principal

        // Reset de estados
        this.errorMsg = null;
        this.successMsg = null;
        this.lookup = null;

        this.routeReady = true;
        if (this.context) {
          this.validatePermissions();
        }
      });

    // Leer modo desde query params (por ejemplo ?mode=delegate)
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((qp) => {
        const mode = (qp.get('mode') || '').toLowerCase();
        if (mode === 'delegate' && this.isEncargado) {
          this.selectedTab = 'delegate';
        } else {
          this.selectedTab = 'existing';
        }
      });

    // Cargar contexto de staff (permisos)
    void this.loadContext();
  }

  // ──────────────────────────────────────────────
  // Contexto (backend)
  // ──────────────────────────────────────────────

  private async loadContext(): Promise<void> {
    this.contextLoading = true;
    this.loader.show('Cargando contexto de staff...'); // 👈 loader global
    try {
      const res: any = await firstValueFrom(this.api.obtenerContextoPanel());
      if (res.ok) {
        this.context = res.data as EpSedeStaffContextPayload;
      } else {
        this.context = null;
        this.errorMsg = res.message || 'No se pudo obtener el contexto de staff.';
      }
    } catch (e: any) {
      console.error(e);
      this.context = null;
      this.errorMsg = e?.message || 'No se pudo obtener el contexto de staff.';
    } finally {
      this.contextLoading = false;
      this.loader.hide(); // 👈 cierre garantizado
      if (this.routeReady) {
        this.validatePermissions();
      }
    }
  }

  /** Verifica que el usuario tenga permiso para gestionar el rol actual. */
  private validatePermissions(): void {
    if (!this.context) return;

    if (this.role === 'COORDINADOR' && !this.canManageCoordinador) {
      this.errorMsg = 'No estás autorizado para gestionar coordinadores.';
      this.volverALaEpSede();
      return;
    }

    if (this.role === 'ENCARGADO' && !this.canManageEncargado) {
      this.errorMsg = 'No estás autorizado para gestionar encargados.';
      this.volverALaEpSede();
      return;
    }
  }

  // ──────────────────────────────────────────────
  // Navegar de regreso
  // ──────────────────────────────────────────────

  volverALaEpSede(): void {
    if (this.epSedeId) {
      this.router.navigate(['/staff/ep-sede', this.epSedeId]);
    } else {
      this.router.navigate(['/staff/ep-sede']);
    }
  }

  // ──────────────────────────────────────────────
  // Tabs
  // ──────────────────────────────────────────────

  changeTab(tab: 'existing' | 'new' | 'delegate'): void {
    if (tab === 'delegate' && !this.isEncargado) return;
    this.selectedTab = tab;
    this.errorMsg = null;
    this.successMsg = null;
  }

  // ──────────────────────────────────────────────
  // Buscar perfil por correo
  // ──────────────────────────────────────────────

  async onBuscarPorCorreo(): Promise<void> {
    if (!this.epSedeId) {
      this.errorMsg = 'EP-Sede inválida en la URL.';
      return;
    }

    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }

    const email = (this.searchForm.value.email || '').trim();
    if (!email) return;

    this.errorMsg = null;
    this.successMsg = null;
    this.lookup = null;
    this.loadingLookup = true;
    this.loader.show('Buscando perfil por correo...'); // 👈 loader global

    try {
      const res = await firstValueFrom(
        this.api.buscarPerfilPorCorreo(this.epSedeId, email)
      );

      if (res.ok) {
        this.lookup = res.data;
        if (!this.lookup.user && !this.lookup.expediente) {
          this.successMsg =
            'No se encontró ningún usuario ni expediente con ese correo.';
        }
      } else {
        this.errorMsg = res.message || 'No se pudo buscar el perfil por correo.';
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Error al buscar el perfil.';
    } finally {
      this.loadingLookup = false;
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  get tieneUsuarioEncontrado(): boolean {
    return !!this.lookup && !!this.lookup.user;
  }

  // ──────────────────────────────────────────────
  // Asignar usando el perfil encontrado
  // ──────────────────────────────────────────────

  async onAsignarDesdeLookup(): Promise<void> {
    if (!this.epSedeId) {
      this.errorMsg = 'EP-Sede inválida.';
      return;
    }
    if (!this.lookup || !this.lookup.user) {
      this.errorMsg = 'Primero busca y selecciona un perfil válido.';
      return;
    }

    const { vigente_desde, motivo } = this.assignForm.value;

    const body: EpSedeStaffAssignInput = {
      role: this.role,
      user_id: this.lookup.user.id,
      vigente_desde: vigente_desde || undefined,
      exclusive: true,
      motivo: motivo || undefined,
    };

    this.errorMsg = null;
    this.successMsg = null;
    this.loadingAssign = true;
    this.loader.show('Asignando staff...'); // 👈 loader global

    try {
      const res = await firstValueFrom(
        this.api.asignarStaff(this.epSedeId, body)
      );

      if (res.ok) {
        this.successMsg = 'Asignación realizada correctamente.';
        await this.router.navigate(['/staff/ep-sede', this.epSedeId]);
      } else {
        this.errorMsg = res.message || 'No se pudo asignar el staff.';
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Error al asignar el staff.';
    } finally {
      this.loadingAssign = false;
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  // ──────────────────────────────────────────────
  // Crear nuevo usuario + asignar
  // ──────────────────────────────────────────────

  async onCrearYAsignar(): Promise<void> {
    if (!this.epSedeId) {
      this.errorMsg = 'EP-Sede inválida.';
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.errorMsg = 'Completa los campos obligatorios del formulario.';
      return;
    }

    const v = this.createForm.value;

    const finalRole =
      (this.spatieRole || '').trim().toUpperCase() ||
      (this.role === 'COORDINADOR' ? 'COORDINADOR' : 'ENCARGADO');

    const body: EpSedeStaffCreateAndAssignInput = {
      role: finalRole,
      username: v.username,
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      doc_tipo: v.doc_tipo || undefined,
      doc_numero: v.doc_numero || undefined,
      celular: v.celular || undefined,
      pais: v.pais || undefined,
      vigente_desde: v.vigente_desde || undefined,
      motivo: v.motivo || undefined,
      correo_institucional: v.correo_institucional || undefined,
    };

    this.errorMsg = null;
    this.successMsg = null;
    this.loadingCreate = true;
    this.loader.show('Creando usuario y asignando...'); // 👈 loader global

    try {
      const res = await firstValueFrom(
        this.api.crearYAsignarStaff(this.epSedeId, body)
      );

      if (res.ok) {
        this.successMsg = 'Usuario creado y asignado correctamente.';
        await this.router.navigate(['/staff/ep-sede', this.epSedeId]);
      } else {
        this.errorMsg = res.message || 'No se pudo crear y asignar el staff.';
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Error al crear y asignar el staff.';
    } finally {
      this.loadingCreate = false;
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  // ──────────────────────────────────────────────
  // Delegar encargado interino
  // ──────────────────────────────────────────────

  async onDelegarEncargado(): Promise<void> {
    if (!this.epSedeId) {
      this.errorMsg = 'EP-Sede inválida.';
      return;
    }
    if (!this.isEncargado) {
      this.errorMsg = 'Solo se puede delegar el rol de Encargado.';
      return;
    }

    if (this.delegateForm.invalid) {
      this.delegateForm.markAllAsTouched();
      this.errorMsg = 'Completa los campos obligatorios.';
      return;
    }

    const v = this.delegateForm.value;
    const userId = Number(v.user_id);

    if (!Number.isFinite(userId) || userId <= 0) {
      this.errorMsg = 'ID de usuario inválido.';
      return;
    }

    const body: EpSedeStaffDelegateInput = {
      role: 'ENCARGADO',
      user_id: userId,
      desde: v.desde,
      hasta: v.hasta,
      motivo: v.motivo || undefined,
    };

    this.errorMsg = null;
    this.successMsg = null;
    this.loadingDelegate = true;
    this.loader.show('Registrando delegación...'); // 👈 loader global

    try {
      const res = await firstValueFrom(
        this.api.delegarEncargadoInterino(this.epSedeId, body)
      );

      if (res.ok) {
        this.successMsg = 'Delegación registrada correctamente.';
        await this.router.navigate(['/staff/ep-sede', this.epSedeId]);
      } else {
        this.errorMsg = res.message || 'No se pudo registrar la delegación.';
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg = e?.message || 'Error al delegar el encargado.';
    } finally {
      this.loadingDelegate = false;
      this.loader.hide(); // 👈 cierre garantizado
    }
  }

  // ──────────────────────────────────────────────
  // Reset del formulario de creación
  // ──────────────────────────────────────────────

  onResetCreateForm(): void {
    const today = new Date().toISOString().slice(0, 10);

    this.createForm.reset({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      doc_tipo: '',
      doc_numero: '',
      celular: '',
      pais: '',
      vigente_desde: today,
      motivo: '',
      correo_institucional: '',
    });

    this.spatieRole = this.role;
    this.errorMsg = null;
    this.successMsg = null;
  }
}
