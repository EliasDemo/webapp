import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdApiService } from '../../data-access/ad-api.service';
import { AdPermission, AdRole } from '../../models/ad.models';

type Group = { key: string; items: AdPermission[] };

@Component({
  standalone: true,
  selector: 'app-rolehaspermission-create-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rolehaspermission-create.page.html',
})
export class RoleHasPermissionCreatePage {
  private api = inject(AdApiService);
  private router = inject(Router);

  // Paso actual (1: crear rol, 2: asignar permisos)
  step = signal<1 | 2>(1);

  // Form paso 1
  name = signal('');
  guard = signal<'web' | string>('web');

  // Estados
  savingRole  = signal(false);
  loadingPerms = signal(false);
  savingPerms = signal(false);
  error = signal<string | null>(null);

  // Datos
  roleId = signal<number | null>(null);
  perms = signal<AdPermission[]>([]);
  selected = signal<Set<string>>(new Set<string>());

  // Validaciones
  canNext = computed(() => this.name().trim().length >= 3 && !this.savingRole());

  // Agrupar permisos por 2 primeros segmentos (ej: vm.proyecto, ep.manage, etc.)
  grouped = computed<Group[]>(() => {
    const arr = this.perms();
    const map = new Map<string, AdPermission[]>();

    for (const p of arr) {
      const parts = (p.name ?? '').split('.');
      const key = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : (parts[0] || 'otros');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const groups: Group[] = Array.from(map.entries()).map(([key, items]) => ({
      key,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return groups.sort((a, b) => a.key.localeCompare(b.key));
  });

  // Método auxiliar para contar seleccionados en grupo
  getSelectedCountInGroup(g: Group): number {
    const set = this.selected();
    return g.items.filter(p => set.has(p.name)).length;
  }

  // ─────────────────────────────────────────────────────────
  // Paso 1 → crear rol y pasar a asignar permisos
  // ─────────────────────────────────────────────────────────
  async nextToPermissions(): Promise<void> {
    if (!this.canNext()) return;

    this.savingRole.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.crearRol({ name: this.name().trim(), guard_name: this.guard() })
      );

      const payload = (res?.data ?? res) as AdRole;
      const id = (payload as any)?.id;
      if (!id) throw new Error('No se pudo obtener el ID del rol creado.');

      this.roleId.set(id);

      await this.loadPermissions();        // carga permisos del guard
      this.selected.set(new Set<string>()); // limpia selección
      this.step.set(2);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? e?.message ?? 'No se pudo crear el rol.');
    } finally {
      this.savingRole.set(false);
    }
  }

  // Carga permisos según guard
  async loadPermissions(): Promise<void> {
    this.loadingPerms.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.listarPermisos(this.guard()));
      this.perms.set((res?.data ?? []) as AdPermission[]);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudieron cargar los permisos.');
    } finally {
      this.loadingPerms.set(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Selección de permisos
  // ─────────────────────────────────────────────────────────
  isChecked(name: string): boolean {
    return this.selected().has(name);
  }

  togglePerm(name: string): void {
    const set = new Set(this.selected());
    if (set.has(name)) set.delete(name);
    else set.add(name);
    this.selected.set(set);
  }

  clearSelection(): void {
    this.selected.set(new Set<string>());
  }

  isGroupFullySelected(g: Group): boolean {
    const set = this.selected();
    return g.items.length > 0 && g.items.every(p => set.has(p.name));
  }

  toggleGroup(g: Group): void {
    const set = new Set(this.selected());
    const allSelected = this.isGroupFullySelected(g);

    if (allSelected) {
      for (const p of g.items) set.delete(p.name);
    } else {
      for (const p of g.items) set.add(p.name);
    }

    this.selected.set(set);
  }

  // ─────────────────────────────────────────────────────────
  // Guardar asignaciones
  // ─────────────────────────────────────────────────────────
  async save(): Promise<void> {
    const id = this.roleId();
    if (!id) {
      this.error.set('ID del rol no disponible.');
      return;
    }
    const names = Array.from(this.selected());
    if (names.length === 0) {
      this.error.set('Selecciona al menos un permiso.');
      return;
    }

    this.savingPerms.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.asignarPermisosARol(id, { permissions: names }));
      // Navega a la lista (ajusta si usas otra ruta)
      this.router.navigate(['/ad/roles']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudieron asignar los permisos.');
    } finally {
      this.savingPerms.set(false);
    }
  }

  // trackBy helpers (evita errores de template)
  trackByGroup = (_: number, g: Group) => g.key;
  trackByPermId = (_: number, p: AdPermission) => p.id;
}
