// src/app/core/state/user.store.ts
import { inject, Injectable, signal, computed } from '@angular/core';
import { UserApi } from '../../features/user/data-access/user.api';
import { UserDetail } from '../../features/user/data-access/user.models';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserStore {
  private api = inject(UserApi);

  private _user = signal<UserDetail | null>(null);
  readonly user = this._user.asReadonly();

  // Atajos existentes
  readonly name   = computed(() => this._user()?.full_name ?? '');
  readonly email  = computed(() => this._user()?.email ?? '');
  readonly status = computed(() => this._user()?.status ?? '');
  readonly photo  = computed(() => this._user()?.profile_photo_url ?? this._user()?.profile_photo ?? null);

  readonly universidad = computed(() => this._user()?.expediente_activo?.universidad?.nombre ?? '—');
  readonly sede        = computed(() => this._user()?.expediente_activo?.sede?.nombre ?? '—');
  readonly facultad    = computed(() =>
    this._user()?.expediente_activo?.facultad?.nombre
    ?? this._user()?.expediente_activo?.escuela_profesional?.facultad?.nombre
    ?? '—'
  );
  readonly escuela     = computed(() => this._user()?.expediente_activo?.escuela_profesional?.nombre ?? '—');

  // 👇 Permisos
  readonly permissions = computed<string[]>(() => this._user()?.permissions ?? []);
  private readonly permSet = computed(() => new Set(this.permissions()));
  has    = (p: string) => this.permSet().has(p);
  hasAny = (ps: string[]) => ps.some(p => this.permSet().has(p));
  hasAll = (ps: string[]) => ps.every(p => this.permSet().has(p));

  // 👇 NUEVO: Roles
  readonly roles = computed<string[]>(() => this._user()?.roles ?? []);
  private readonly roleSet = computed(() => new Set(this.roles()));
  hasRole    = (r: string) => this.roleSet().has(r);
  hasAnyRole = (rs: string[]) => rs.some(r => this.roleSet().has(r));
  hasAllRole = (rs: string[]) => rs.every(r => this.roleSet().has(r));

  loadMe(): void {
    this.api.me().subscribe({
      next: u => this._user.set(u),
      error: () => this._user.set(null),
    });
  }

  // Carga si hace falta (para guards). Devuelve observable.
  loadIfNeeded$() {
    if (this._user()) return of(this._user());
    return this.api.me().pipe(
      tap(u => this._user.set(u)),
      catchError(() => {
        this._user.set(null);
        return of(null);
      })
    );
  }

  clear(): void { this._user.set(null); }
}
