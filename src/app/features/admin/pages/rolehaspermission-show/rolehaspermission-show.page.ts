import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdApiService } from '../../data-access/ad-api.service';
import { AdPermission, AdRole } from '../../models/ad.models';

type Group = { key: string; items: AdPermission[] };

@Component({
  standalone: true,
  selector: 'app-rolehaspermission-show-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rolehaspermission-show.page.html',
  styleUrls: ['./rolehaspermission-show.page.scss'],
})
export class RoleHasPermissionShowPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AdApiService);

  // Estado base
  loading = signal(true);
  error   = signal<string | null>(null);

  // Estado de operaciones
  savingRename  = signal(false);
  savingPerms   = signal(false);
  deletingRole  = signal(false);
  loadingPerms  = signal(false);

  // Datos
  role     = signal<AdRole | null>(null);
  allPerms = signal<AdPermission[]>([]); // todos los permisos del guard

  // Edición de nombre
  editMode = signal(false);
  editName = signal('');

  // Añadir permisos
  addOpen     = signal(false);
  addFilter   = signal('');
  addSelected = signal<Set<string>>(new Set<string>());

  // Cálculos
  isAdmin = computed(() => (this.role()?.name ?? '').toUpperCase() === 'ADMINISTRADOR');

  currentPerms = computed<AdPermission[]>(() => this.role()?.permissions ?? []);
  currentPermNames = computed<Set<string>>(
    () => new Set(this.currentPerms().map(p => p.name))
  );

  grouped = computed<Group[]>(() => this.groupByPrefix(this.currentPerms()));

  availablePerms = computed<AdPermission[]>(
    () => this.allPerms().filter(p => !this.currentPermNames().has(p.name))
  );

  availableFiltered = computed<AdPermission[]>(() => {
    const term = this.addFilter().trim().toLowerCase();
    if (!term) return this.availablePerms();
    return this.availablePerms().filter(p => p.name.toLowerCase().includes(term));
  });

  availableGrouped = computed<Group[]>(
    () => this.groupByPrefix(this.availableFiltered())
  );

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.router.navigate(['/ad/roles']);
      return;
    }
    this.loadRole(id);
  }

  // ─────────────────────────────────────────────────────────
  // Carga
  // ─────────────────────────────────────────────────────────
  private async loadRole(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.obtenerRol(id));
      const r = (res?.data ?? res) as AdRole;
      this.role.set(r);
      this.editName.set(r.name ?? '');

      await this.loadAllPermsForGuard(r.guard_name || 'web');
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar el rol.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAllPermsForGuard(guard: string) {
    this.loadingPerms.set(true);
    try {
      const res = await firstValueFrom(this.api.listarPermisos(guard));
      this.allPerms.set((res?.data ?? []) as AdPermission[]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudieron cargar los permisos disponibles.');
    } finally {
      this.loadingPerms.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────────────────────
  private groupByPrefix(list: AdPermission[]): Group[] {
    const map = new Map<string, AdPermission[]>();
    for (const p of list) {
      const parts = (p.name ?? '').split('.');
      const key = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : (parts[0] || 'otros');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  trackByGroup = (_: number, g: Group) => g.key;
  trackByPermId = (_: number, p: AdPermission) => p.id;

  // ─────────────────────────────────────────────────────────
  // Renombrar rol
  // ─────────────────────────────────────────────────────────
  startEditName() {
    if (this.isAdmin()) return;
    this.editName.set(this.role()?.name ?? '');
    this.editMode.set(true);
  }

  cancelEditName() {
    this.editMode.set(false);
    this.editName.set(this.role()?.name ?? '');
  }

  async saveName() {
    const r = this.role();
    if (!r || this.isAdmin()) return;

    const name = this.editName().trim();
    if (name.length < 3) {
      this.error.set('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    this.savingRename.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.renombrarRol(r.id, { name, guard_name: r.guard_name }));
      const updated = (res?.data ?? res) as AdRole;
      this.role.set({ ...r, name: updated.name });
      this.editMode.set(false);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo renombrar el rol.');
    } finally {
      this.savingRename.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Eliminar rol
  // ─────────────────────────────────────────────────────────
  async deleteRole() {
    const r = this.role();
    if (!r || this.isAdmin()) return;
    const ok = window.confirm('¿Eliminar este rol? Se desvincularán sus permisos.');
    if (!ok) return;

    this.deletingRole.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.eliminarRol(r.id));
      this.router.navigate(['/ad/roles']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo eliminar el rol.');
    } finally {
      this.deletingRole.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Quitar permisos (usa DELETE con body)
  // ─────────────────────────────────────────────────────────
  async removePerm(name: string) {
    const r = this.role();
    if (!r || this.isAdmin()) return;

    const ok = window.confirm(`¿Quitar el permiso "${name}" del rol "${r.name}"?`);
    if (!ok) return;

    this.savingPerms.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.revocarPermisosDeRol(r.id, [name]));
      const updated = (res?.data ?? res) as AdRole | undefined;
      if (updated?.permissions) {
        this.role.set({ ...r, permissions: updated.permissions });
      } else {
        // fallback: quitar localmente
        const left = (r.permissions ?? []).filter(p => p.name !== name);
        this.role.set({ ...r, permissions: left });
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo quitar el permiso.');
    } finally {
      this.savingPerms.set(false);
    }
  }

  async removeGroup(g: Group) {
    const r = this.role();
    if (!r || this.isAdmin()) return;

    const ok = window.confirm(
      `¿Quitar TODOS los permisos del grupo "${g.key}" del rol "${r.name}"?\n(${g.items.length} permisos)`
    );
    if (!ok) return;

    this.savingPerms.set(true);
    this.error.set(null);
    try {
      const names = g.items.map(p => p.name);
      const res = await firstValueFrom(this.api.revocarPermisosDeRol(r.id, names));
      const updated = (res?.data ?? res) as AdRole | undefined;
      if (updated?.permissions) {
        this.role.set({ ...r, permissions: updated.permissions });
      } else {
        // fallback: quitar localmente
        const toRemove = new Set(names);
        const left = (r.permissions ?? []).filter(p => !toRemove.has(p.name));
        this.role.set({ ...r, permissions: left });
      }
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudieron quitar los permisos del grupo.');
    } finally {
      this.savingPerms.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Añadir permisos (usa POST /assign)
  // ─────────────────────────────────────────────────────────
  toggleAddOpen() {
    if (this.isAdmin()) return;
    this.addOpen.set(!this.addOpen());
    if (!this.addOpen()) {
      this.addFilter.set('');
      this.addSelected.set(new Set<string>());
    }
  }

  isAddChecked(name: string) {
    return this.addSelected().has(name);
  }

  toggleAdd(name: string) {
    const set = new Set(this.addSelected());
    if (set.has(name)) set.delete(name); else set.add(name);
    this.addSelected.set(set);
  }

  isAddGroupFullySelected(g: Group): boolean {
    const set = this.addSelected();
    return g.items.length > 0 && g.items.every(p => set.has(p.name));
  }

  toggleAddGroup(g: Group) {
    const set = new Set(this.addSelected());
    const all = this.isAddGroupFullySelected(g);
    if (all) {
      for (const p of g.items) set.delete(p.name);
    } else {
      for (const p of g.items) set.add(p.name);
    }
    this.addSelected.set(set);
  }

  clearAddSelection() {
    this.addSelected.set(new Set<string>());
  }

  async saveAdd() {
    const r = this.role();
    if (!r || this.isAdmin()) return;

    const extra = Array.from(this.addSelected());
    if (extra.length === 0) return;

    this.savingPerms.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.agregarPermisosARol(r.id, extra));
      const updated = (res?.data ?? res) as AdRole | undefined;
      if (updated?.permissions) {
        this.role.set({ ...r, permissions: updated.permissions });
      } else {
        // fallback: mezclar localmente
        const curr = new Set((r.permissions ?? []).map(p => p.name));
        extra.forEach(n => curr.add(n));
        // Si no tienes los objetos AdPermission para los nuevos, recarga:
        await this.loadRole(r.id);
      }
      // limpiar selector
      this.addFilter.set('');
      this.addSelected.set(new Set<string>());
      this.addOpen.set(false);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudieron agregar los permisos.');
    } finally {
      this.savingPerms.set(false);
    }
  }
}
