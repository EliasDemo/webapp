import { Component, computed, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthApi } from '../data-access/auth.api';
import { AlertService } from '../../../shared/ui/alert/alert.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, NgIf, TranslocoPipe],
  template: `
<div class="min-h-dvh grid place-items-center p-4">
  <div class="w-full max-w-md rounded-2xl border p-6 bg-white">
    <h1 class="text-xl font-semibold mb-4">{{ title() }}</h1>

    <!-- Paso 1: username -->
    <form *ngIf="step() === 1"
          [formGroup]="lookupForm"
          (ngSubmit)="submitLookup()"
          class="space-y-4">
      <div>
        <label class="block text-sm mb-1">{{ 'app.language' | transloco }}: {{ lang }}</label>
        <label class="block text-sm mb-1" for="username">Username</label>
        <input id="username"
               class="w-full border rounded px-3 py-2"
               formControlName="username"
               autocomplete="username"
               placeholder="tu.usuario" />
        <small class="text-red-600" *ngIf="username.invalid && username.touched">Requerido</small>
      </div>
      <button type="submit"
              class="w-full rounded bg-black text-white py-2 disabled:opacity-50"
              [disabled]="lookupForm.invalid">
        Continuar
      </button>
    </form>

    <!-- Paso 2: password -->
    <form *ngIf="step() === 2"
          [formGroup]="loginForm"
          (ngSubmit)="submitLogin()"
          class="space-y-4">
      <div class="flex items-center gap-3">
        <img *ngIf="profilePhoto()" [src]="profilePhoto()!" class="w-12 h-12 rounded-full object-cover border" />
        <div>
          <div class="font-semibold">{{ fullName() }}</div>
          <div class="text-sm opacity-70">{{ escuela() }}</div>
          <div class="text-xs opacity-60">Rol: {{ rol() || '—' }}</div>
        </div>
      </div>

      <div>
        <label class="block text-sm mb-1" for="password">Password</label>
        <input id="password"
               class="w-full border rounded px-3 py-2"
               type="password"
               formControlName="password"
               autocomplete="current-password"
               placeholder="••••••••" />
        <small class="text-red-600" *ngIf="password.invalid && password.touched">Requerido</small>
      </div>

      <div class="flex gap-2">
        <button type="button" class="flex-1 rounded border py-2" (click)="back()">Cambiar usuario</button>
        <button type="submit"
                class="flex-1 rounded bg-black text-white py-2 disabled:opacity-50"
                [disabled]="loginForm.invalid">
          Ingresar
        </button>
      </div>
    </form>
  </div>
</div>
  `
})
export class LoginPage {
  private api = inject(AuthApi);
  private alerts = inject(AlertService);
  private router = inject(Router);

  // Solo para mostrar idioma actual (opcional)
  lang: string = document.documentElement.lang || 'es';

  // Paso actual
  private _step = signal<1 | 2>(1);
  step = this._step.asReadonly();

  // ✅ Formularios tipados (para que (ngSubmit) funcione y evitar recarga)
  lookupForm = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  loginForm = new FormGroup({
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  // Getters cómodos
  get username() { return this.lookupForm.controls.username; }
  get password() { return this.loginForm.controls.password; }

  // Datos para mostrar en paso 2
  private _fullName = signal<string>('');
  private _profilePhoto = signal<string | null>(null);
  private _escuela = signal<string | null>(null);
  private _rol = signal<string | null>(null);

  fullName = this._fullName.asReadonly();
  profilePhoto = this._profilePhoto.asReadonly();
  escuela = this._escuela.asReadonly();
  rol = this._rol.asReadonly();

  title = computed(() => this.step() === 1 ? 'Identifícate' : 'Confirma y escribe tu contraseña');

  submitLookup() {
    if (this.lookupForm.invalid) { this.lookupForm.markAllAsTouched(); return; }
    const username = this.username.value.trim();

    this.api.lookup({ username }).subscribe({
      next: res => {
        this._fullName.set(res.user.full_name);
        this._profilePhoto.set(res.user.profile_photo);
        this._rol.set(res.user.rol_principal);
        this._escuela.set(res.academico?.escuela_profesional ?? null);
        this._step.set(2);
      },
      error: err => {
        if (err.status === 404) this.alerts.warn('Usuario no encontrado.');
        else this.alerts.error('No se pudo verificar el usuario.');
      }
    });
  }

  back() {
    this.loginForm.reset();
    this._step.set(1);
  }

  submitLogin() {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    const payload = {
      username: this.username.value.trim(),
      password: this.password.value
    };

    this.api.login(payload).subscribe({
      next: () => {
        this.alerts.success('Bienvenido 👋');
        this.router.navigateByUrl('/dashboard');
      },
      error: err => {
        if (err.status === 422) this.alerts.warn('Credenciales inválidas.');
        else this.alerts.error('No se pudo iniciar sesión.');
      }
    });
  }
}
