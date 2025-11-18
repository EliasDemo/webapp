import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PerfilApiService } from '../../data-access/perfil-api.service';
import {
  ChangePasswordPayload,
  MeResponse,
  ProfileUpdatePayload,
  SessionsResponse,
  UserDetail,
  UserSession,
  ExpedienteLite,
} from '../../models/perfil.models';

import { LoaderService } from '../../../../shared/ui/loader/loader.service';

@Component({
  standalone: true,
  selector: 'app-perfil-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './perfil.page.html',
})
export class PerfilPage implements OnInit {
  private perfilApi = inject(PerfilApiService);
  private loader = inject(LoaderService);

  // Estado general
  loadingProfile = signal(true);
  loadingSessions = signal(true);
  savingProfile = signal(false);
  changingPassword = signal(false);

  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  // Datos cargados del backend
  profile = signal<UserDetail | null>(null);
  sessions = signal<UserSession[]>([]);

  // Formularios (usando signals + onChange, como en tu HistoryPage)
  profileForm = signal<ProfileUpdatePayload>({
    first_name: '',
    last_name: '',
    email: '',
    celular: '',
    religion: '',
    expediente_id: undefined,
    correo_institucional: '',
    profile_photo: null,
  });

  passwordForm = signal<ChangePasswordPayload>({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  // Foto de perfil (preview)
  photoPreview = signal<string | null>(null);

  // Derivados
  expedientes = computed<ExpedienteLite[]>(() => {
    return (this.profile()?.expedientesAcademicos ?? []) as ExpedienteLite[];
  });

  avatarUrl = computed<string | null>(() => {
    return this.photoPreview() || this.profile()?.profile_photo || null;
  });

  avatarInitials = computed<string>(() => {
    const u = this.profile();
    if (!u) return '?';
    const f = (u.first_name || '').trim();
    const l = (u.last_name || '').trim();
    const initials =
      (f ? f[0] : '') + (l ? l[0] : '');
    if (initials) return initials.toUpperCase();
    return (u.username || '?')[0]?.toUpperCase() || '?';
  });

  activeSessionsCount = computed(() => this.sessions().length);

  ngOnInit(): void {
    void this.loadProfile();
    void this.loadSessions();
  }

  // ─────────────────────────────────────────────
  // Carga inicial
  // ─────────────────────────────────────────────

  async loadProfile(): Promise<void> {
    this.loadingProfile.set(true);
    this.errorMsg.set(null);

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.getMe(),
          'Cargando perfil...'
        )
      );

      this.onProfileLoaded(res);
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('No se pudo cargar tu perfil.');
    } finally {
      this.loadingProfile.set(false);
    }
  }

  async loadSessions(): Promise<void> {
    this.loadingSessions.set(true);

    try {
      const res: SessionsResponse = await firstValueFrom(
        this.perfilApi.getSessions()
      );
      if (res.ok) {
        this.sessions.set(res.sessions ?? []);
      } else {
        this.errorMsg.set('No se pudo cargar las sesiones.');
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('No se pudo cargar las sesiones.');
    } finally {
      this.loadingSessions.set(false);
    }
  }

  private onProfileLoaded(res: MeResponse): void {
    if (!res.ok || !res.user) {
      this.errorMsg.set('Error al cargar el perfil.');
      return;
    }

    this.profile.set(res.user);
    this.patchProfileFormFromUser(res.user);
  }

  private patchProfileFormFromUser(user: UserDetail): void {
    const exps = (user.expedientesAcademicos ?? []) as ExpedienteLite[];
    const first = exps[0] ?? null;

    this.profileForm.set({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      celular: user.celular ?? '',
      religion: user.religion ?? '',
      expediente_id: first?.id,
      correo_institucional: first?.correo_institucional ?? '',
      profile_photo: null,
    });

    this.photoPreview.set(null);
  }

  // ─────────────────────────────────────────────
  // Handlers de formulario de perfil
  // ─────────────────────────────────────────────

  onProfileFieldChange(field: keyof ProfileUpdatePayload, value: any): void {
    this.profileForm.update((f) => ({
      ...f,
      [field]: value === '' ? null : value,
    }));
  }

  onExpedienteChange(value: string): void {
    const id = value ? Number(value) : undefined;
    const exp = this.expedientes().find((e) => e.id === id);

    this.profileForm.update((f) => ({
      ...f,
      expediente_id: id,
      correo_institucional: exp?.correo_institucional ?? '',
    }));
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.profileForm.update((f) => ({ ...f, profile_photo: null }));
      this.photoPreview.set(null);
      return;
    }

    this.profileForm.update((f) => ({ ...f, profile_photo: file }));
    this.photoPreview.set(URL.createObjectURL(file));
  }

  async onSubmitProfile(): Promise<void> {
    this.savingProfile.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    const payload = this.profileForm();

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.updateMe(payload),
          'Guardando cambios...'
        )
      );

      if ((res as any).ok === false) {
        this.errorMsg.set((res as any).message || 'No se pudo actualizar el perfil.');
        return;
      }

      // Si la respuesta trae user, lo usamos
      if ((res as MeResponse).user) {
        this.onProfileLoaded(res as MeResponse);
      } else {
        // Si no, recargamos el perfil desde el backend
        await this.loadProfile();
      }

      this.successMsg.set('Perfil actualizado correctamente.');
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('Ocurrió un error al actualizar el perfil.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  // ─────────────────────────────────────────────
  // Handlers de contraseña
  // ─────────────────────────────────────────────

  onPasswordFieldChange(
    field: keyof ChangePasswordPayload,
    value: string
  ): void {
    this.passwordForm.update((p) => ({
      ...p,
      [field]: value,
    }));
  }

  async onSubmitPassword(): Promise<void> {
    this.changingPassword.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    const payload = this.passwordForm();

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.changePassword(payload),
          'Actualizando contraseña...'
        )
      );

      if (!res.ok) {
        this.errorMsg.set(res.message || 'No se pudo cambiar la contraseña.');
        return;
      }

      this.successMsg.set('Contraseña actualizada correctamente.');

      // Limpiar form
      this.passwordForm.set({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('Ocurrió un error al cambiar la contraseña.');
    } finally {
      this.changingPassword.set(false);
    }
  }

  // ─────────────────────────────────────────────
  // Sesiones
  // ─────────────────────────────────────────────

  async onCloseSession(session: UserSession): Promise<void> {
    if (!session) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.closeSession(session.id),
          'Cerrando sesión...'
        )
      );

      if (!res.ok) {
        this.errorMsg.set(res.message || 'No se pudo cerrar la sesión.');
        return;
      }

      this.successMsg.set(
        session.is_current
          ? 'Esta sesión se cerrará. Es posible que tengas que volver a iniciar sesión.'
          : 'Sesión cerrada correctamente.'
      );

      await this.loadSessions();
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('Ocurrió un error al cerrar la sesión.');
    }
  }

  // ─────────────────────────────────────────────
  // Utilidades UI
  // ─────────────────────────────────────────────

  dismissError(): void {
    this.errorMsg.set(null);
  }

  dismissSuccess(): void {
    this.successMsg.set(null);
  }

  trackSession = (_: number, s: UserSession) => s.id;
  trackExpediente = (_: number, e: ExpedienteLite) => e.id;
}
