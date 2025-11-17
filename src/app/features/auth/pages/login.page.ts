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

  // error específico de login (mensaje devuelto por el backend)
  loginError = signal<string>('');

  // forms
  lookupForm = new FormGroup({
    username: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  loginForm = new FormGroup({
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  // getters convenientes
  get username() {
    return this.lookupForm.controls.username;
  }
  get password() {
    return this.loginForm.controls.password;
  }

  // datos de usuario
  private _fullName = signal<string>('');
  private _profilePhoto = signal<string | null>(null);
  private _escuela = signal<string | null>(null);
  private _sede = signal<string | null>(null);
  private _rol = signal<string | null>(null);

  fullName = this._fullName.asReadonly();
  profilePhoto = this._profilePhoto.asReadonly();
  escuela = this._escuela.asReadonly();
  sede = this._sede.asReadonly();
  rol = this._rol.asReadonly();

  // títulos
  title = computed(() =>
    this.step() === 1 ? 'Identifícate' : 'Escribe tu contraseña'
  );

  // ¿La cuenta está bloqueada? (según el mensaje del backend)
  isLocked = computed(() => {
    const msg = this.loginError();
    return !!msg && msg.toLowerCase().includes('demasiados intentos fallidos');
  });

  // ui
  togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  // acciones
  submitLookup() {
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const username = this.username.value.trim();
    this.api.lookup({ username }).subscribe({
      next: (res) => {
        this._fullName.set(res.user.full_name);
        this._profilePhoto.set(res.user.profile_photo ?? null);

        // rol principal si existe, sino primer rol
        const principal = res.user.rol_principal ?? res.user.roles?.[0] ?? null;
        this._rol.set(principal);

        this._escuela.set(res.academico?.escuela_profesional ?? null);
        this._sede.set(res.academico?.sede ?? null);

        this._step.set(2);
        this.loginError.set('');
      },
      error: (err) => {
        if (err?.status === 404) {
          this.alerts.warn('Usuario no encontrado.');
        } else {
          this.alerts.error('No se pudo verificar el usuario.');
        }
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
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const payload = {
      username: this.username.value.trim(),
      password: this.password.value,
    };

    this.api.login(payload).subscribe({
      next: () => {
        this.loginError.set('');
        this.password.reset();
        this.showPassword.set(false);

        this.alerts.success('Bienvenido 👋');
        this.router.navigateByUrl('/dashboard').then(() => {
          this.footerToast.showWelcome(5000);
        });
      },
      error: (err) => {
        if (err?.status === 422) {
          // ValidationException de Laravel
          const msg =
            err.error?.errors?.credentials?.[0] ??
            'Credenciales inválidas.';

          this.loginError.set(msg);
          this.alerts.warn(msg);

          this.password.reset();
          this.showPassword.set(false);
        } else {
          this.loginError.set(
            'Error al iniciar sesión. Intenta nuevamente.'
          );
          this.alerts.error('No se pudo iniciar sesión.');
        }
      },
    });
  }

  requestPasswordReset() {
    const username = this.username.value.trim();
    if (!username) {
      this.alerts.warn('Ingresa tu usuario para restablecer la contraseña.');
      return;
    }
    this.alerts.info('Función de restablecimiento en desarrollo…');
    // this.api.requestPasswordReset({ username }).subscribe(...)
  }

  ngOnDestroy() {
    // ya no usamos timers de bloqueo local
  }
}
