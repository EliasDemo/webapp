import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdApiService } from '../../data-access/ad-api.service';
import { AdRole } from '../../models/ad.models';

@Component({
  standalone: true,
  selector: 'app-rolehaspermission-list-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rolehaspermission-list.page.html',
})
export class RoleHasPermissionListPage {
  private api = inject(AdApiService);
  private router = inject(Router);

  // estado
  loading = signal(true);
  error   = signal<string | null>(null);
  items   = signal<AdRole[]>([]);

  // filtros
  q     = signal('');
  guard = signal<'web' | string>('web');

  // computed properties mejoradas
  filtered = computed(() => {
    const term  = this.q().toLowerCase();
    const guard = this.guard();
    let r = this.items();

    if (guard) r = r.filter(x => x.guard_name === guard);
    if (term) {
      r = r.filter(x =>
        x.name.toLowerCase().includes(term) ||
        (x.permissions ?? []).some(p => (p.name ?? '').toLowerCase().includes(term))
      );
    }
    return r;
  });

  hasActiveFilters = computed(() => !!this.q() || this.guard() !== 'web');

  totalUsers = computed(() =>
    this.filtered().reduce((sum, role) => sum + (role.users_count || 0), 0)
  );

  totalPermissions = computed(() =>
    this.filtered().reduce((sum, role) => sum + (role.permissions?.length || 0), 0)
  );

  constructor() {
    this.cargarRoles();
  }

  async cargarRoles(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.listarRoles({ guard: this.guard(), search: this.q() || undefined })
      );
      this.items.set((res?.data ?? []) as AdRole[]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'Error al cargar los roles. Por favor, intente nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  onGuardChange(v: string) {
    this.guard.set(v || 'web');
    this.cargarRoles();
  }

  handleSearch() {
    this.cargarRoles();
  }

  async handleClear() {
    this.q.set('');
    this.guard.set('web');
    await this.cargarRoles();
  }

  // Métodos para los botones de acción
  goToView(role: AdRole, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/ad/roles', role.id]);
  }

  goToEdit(role: AdRole, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/ad/roles', role.id, 'editar']);
  }

  trackById = (_: number, r: AdRole) => r.id;
}
