import { inject, Injectable, signal, computed } from '@angular/core';
import { UserApi } from '../../features/user/data-access/user.api';
import { UserDetail } from '../../features/user/data-access/user.models';

@Injectable({ providedIn: 'root' })
export class UserStore {
  private api = inject(UserApi);

  private _user = signal<UserDetail | null>(null);
  readonly user = this._user.asReadonly();

  // Atajos para la UI
  readonly name   = computed(() => this._user()?.full_name ?? '');
  readonly email  = computed(() => this._user()?.email ?? '');
  readonly status = computed(() => this._user()?.status ?? '');
  readonly photo  = computed(() => this._user()?.profile_photo_url ?? this._user()?.profile_photo ?? null);

  readonly universidad = computed(() => this._user()?.expediente_activo?.universidad?.nombre ?? '—');
  readonly sede        = computed(() => this._user()?.expediente_activo?.sede?.nombre ?? '—');
  readonly facultad    = computed(() => this._user()?.expediente_activo?.facultad?.nombre
                                  ?? this._user()?.expediente_activo?.escuela_profesional?.facultad?.nombre
                                  ?? '—');
  readonly escuela     = computed(() => this._user()?.expediente_activo?.escuela_profesional?.nombre ?? '—');

  loadMe(): void {
    this.api.me().subscribe({
      next: u => this._user.set(u),
      error: () => this._user.set(null),
    });
  }

  clear(): void {
    this._user.set(null);
  }
}
