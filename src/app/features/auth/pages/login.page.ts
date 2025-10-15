import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { NgIf } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthApi } from '../data-access/auth.api';
import { AlertService } from '../../../shared/ui/alert/alert.service';
import { FooterToastService } from '../../../core/layout/footer/footer-toast.service';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnDestroy {
  private api = inject(AuthApi);
  private alerts = inject(AlertService);
  private router = inject(Router);
  private footerToast = inject(FooterToastService);

  // idioma actual (opcional)
  lang: string = document.documentElement.lang || 'es';

  // paso / estado UI
  private _step = signal<1 | 2>(1);
  step = this._step.asReadonly();
  showPassword = signal(false);

  // intentos y bloqueo
  private _failedAttempts = signal(0);
  private _isLocked = signal(false);
  private _lockUntil = signal<Date | null>(null);

  failedAttempts = this._failedAttempts.asReadonly();
  isLocked = this._isLocked.asReadonly();
  lockUntil = this._lockUntil.asReadonly();

  // error específico de login
  loginError = signal<string>('');

  // timer de desbloqueo
  private unlockTimer: ReturnType<typeof setInterval> | null = null;

  // forms
  lookupForm = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });
  loginForm = new FormGroup({
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  // getters convenientes
  get username() { return this.lookupForm.controls.username; }
  get password() { return this.loginForm.controls.password; }

  // datos de usuario
  private _fullName = signal<string>('');
  private _profilePhoto = signal<string | null>(null);
  private _escuela = signal<string | null>(null);
  private _rol = signal<string | null>(null);

  fullName = this._fullName.asReadonly();
  profilePhoto = this._profilePhoto.asReadonly();
  escuela = this._escuela.asReadonly();
  rol = this._rol.asReadonly();

  // títulos y timers
  title = computed(() => this.step() === 1 ? 'Identifícate' : 'Escribe tu contraseña');
  remainingTime = computed(() => {
    const until = this.lockUntil();
    if (!until) return 0;
    const diff = until.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });

  // ui
  togglePasswordVisibility() { this.showPassword.update(v => !v); }

  // bloqueo
  private checkAccountLock() {
    const until = this.lockUntil();
    if (until && new Date() < until) {
      this._isLocked.set(true);
      this.startUnlockTimer();
    } else {
      this._isLocked.set(false);
      this._lockUntil.set(null);
    }
  }

  private startUnlockTimer() {
    if (this.unlockTimer) clearInterval(this.unlockTimer);
    this.unlockTimer = setInterval(() => {
      if (this.remainingTime() <= 0) {
        this._isLocked.set(false);
        this._lockUntil.set(null);
        this._failedAttempts.set(0);
        if (this.unlockTimer) clearInterval(this.unlockTimer);
      }
    }, 1000);
  }

  // acciones
  submitLookup() {
    if (this.lookupForm.invalid) { this.lookupForm.markAllAsTouched(); return; }

    this.checkAccountLock();
    if (this.isLocked()) {
      this.alerts.warn(`Cuenta bloqueada. Espera ${this.remainingTime()} segundos.`);
      return;
    }

    const username = this.username.value.trim();
    this.api.lookup({ username }).subscribe({
      next: (res) => {
        this._fullName.set(res.user.full_name);
        this._profilePhoto.set(res.user.profile_photo);
        this._rol.set(res.user.rol_principal);
        this._escuela.set(res.academico?.escuela_profesional ?? null);
        this._step.set(2);
        this.loginError.set('');
      },
      error: (err) => {
        if (err?.status === 404) this.alerts.warn('Usuario no encontrado.');
        else this.alerts.error('No se pudo verificar el usuario.');
      },
    });
  }

  back() {
    this.loginForm.reset();
    this.showPassword.set(false);
    this.loginError.set('');
    this._step.set(1);
  }

  submitLogin() {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }

    this.checkAccountLock();
    if (this.isLocked()) {
      this.alerts.warn(`Cuenta bloqueada. Espera ${this.remainingTime()} segundos.`);
      return;
    }

    const payload = { username: this.username.value.trim(), password: this.password.value };
    this.api.login(payload).subscribe({
      next: () => {
        this._failedAttempts.set(0);
        this.loginError.set('');
        this.alerts.success('Bienvenido 👋');
        this.router.navigateByUrl('/dashboard').then(() => {
          this.footerToast.showWelcome(5000);
        });
      },
      error: (err) => {
        if (err?.status === 422) {
          const newAttempts = this._failedAttempts() + 1;
          this._failedAttempts.set(newAttempts);

          if (newAttempts >= 3) {
            const lockTime = new Date(Date.now() + 2 * 60 * 1000); // 2 min
            this._lockUntil.set(lockTime);
            this._isLocked.set(true);
            this.startUnlockTimer();

            this.loginError.set('Demasiados intentos. Cuenta bloqueada por 2 minutos.');
            this.alerts.warn('Cuenta bloqueada temporalmente.');
          } else {
            const remaining = 3 - newAttempts;
            this.loginError.set(`Contraseña incorrecta. ${remaining} intentos restantes.`);
          }

          this.password.reset();
          this.showPassword.set(false);
        } else {
          this.loginError.set('Error al iniciar sesión. Intenta nuevamente.');
          this.alerts.error('No se pudo iniciar sesión.');
        }
      },
    });
  }

  requestPasswordReset() {
    const username = this.username.value.trim();
    if (!username) { this.alerts.warn('Ingresa tu usuario para restablecer la contraseña.'); return; }
    this.alerts.info('Función de restablecimiento en desarrollo…');
    // this.api.requestPasswordReset({ username }).subscribe(...)
  }

  ngOnDestroy() {
    if (this.unlockTimer) clearInterval(this.unlockTimer);
  }
}
