import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdApiService } from '../../data-access/ad-api.service';
import { Universidad } from '../../models/ad.models';

@Component({
  standalone: true,
  selector: 'app-universidad-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './universidad.page.html',
  styleUrls: ['./universidad.page.scss'],
})
export class UniversidadPage {
  private api = inject(AdApiService);

  // estado base
  loading = signal(true);
  saving  = signal(false);
  error   = signal<string | null>(null);
  uni     = signal<Universidad | null>(null);

  // form
  codigo  = signal('');
  nombre  = signal('');
  gestion = signal('');
  licencia= signal('');

  // uploads
  uploadingLogo    = signal(false);
  uploadingPortada = signal(false);

  // Opciones (alineadas al backend)
  gestionOpts  = signal<string[]>(['PUBLICO', 'PRIVADO']);
  licenciaOpts = signal<string[]>(['NINGUNO', 'LICENCIA_OTORGADA', 'LICENCIA_DENEGADA', 'EN_PROCESO']);

  // Computed properties mejoradas
  canSave = computed(() =>
    !!this.codigo().trim() &&
    this.nombre().trim().length >= 3 &&
    !!this.gestion().trim() &&
    !!this.licencia().trim() &&
    !this.saving()
  );

  hasChanges = computed(() => {
    const u = this.uni();
    if (!u) return false;
    return this.codigo() !== u.codigo ||
           this.nombre() !== u.nombre ||
           this.gestion() !== u.tipo_gestion ||
           this.licencia() !== u.estado_licenciamiento;
  });

  constructor() {
    this.load();
  }

  private ensureOption(setter: (v: string[]) => void, cur: string, base: string[]) {
    const s = new Set(base);
    if (cur && !s.has(cur)) s.add(cur);
    setter(Array.from(s));
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.obtenerUniversidad());
      const u = (res?.data ?? res) as Universidad;
      this.uni.set(u);

      this.codigo.set(u.codigo ?? '');
      this.nombre.set(u.nombre ?? '');
      this.gestion.set(u.tipo_gestion ?? '');
      this.licencia.set(u.estado_licenciamiento ?? '');

      this.ensureOption(this.gestionOpts.set.bind(this.gestionOpts), this.gestion(), this.gestionOpts());
      this.ensureOption(this.licenciaOpts.set.bind(this.licenciaOpts), this.licencia(), this.licenciaOpts());
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo cargar la información universitaria.');
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    if (!this.canSave() || !this.hasChanges()) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.api.actualizarUniversidad({
          codigo: this.codigo().trim(),
          nombre: this.nombre().trim(),
          tipo_gestion: this.gestion().trim(),
          estado_licenciamiento: this.licencia().trim(),
        })
      );
      const u = (res?.data ?? res) as Universidad;
      this.uni.set(u);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo actualizar la información.');
    } finally {
      this.saving.set(false);
    }
  }

  // ── uploads
  async onLogoFile(ev: Event) {
    const file = (ev.target as HTMLInputElement)?.files?.[0];
    if (!file) return;

    // Validación básica de archivo
    if (!file.type.startsWith('image/')) {
      this.error.set('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    this.uploadingLogo.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.setUniversidadLogo(file));
      const u = (res?.data ?? res) as Universidad;
      this.uni.set(u);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo subir el logo. Intenta con otra imagen.');
    } finally {
      (ev.target as HTMLInputElement).value = '';
      this.uploadingLogo.set(false);
    }
  }

  async onPortadaFile(ev: Event) {
    const file = (ev.target as HTMLInputElement)?.files?.[0];
    if (!file) return;

    // Validación básica de archivo
    if (!file.type.startsWith('image/')) {
      this.error.set('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    this.uploadingPortada.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.setUniversidadPortada(file));
      const u = (res?.data ?? res) as Universidad;
      this.uni.set(u);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo subir la portada. Intenta con otra imagen.');
    } finally {
      (ev.target as HTMLInputElement).value = '';
      this.uploadingPortada.set(false);
    }
  }

  // ── helpers URL mejorados
  private toAbsolute(u?: string | null): string {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('/')) return u;
    return `/${u}`;
  }

  logoUrl(): string {
    const u = this.uni();
    return this.toAbsolute(u?.logo?.url ?? (u as any)?.logo?.url_publica ?? u?.logo?.path);
  }

  portadaUrl(): string {
    const u = this.uni();
    return this.toAbsolute(u?.portada?.url ?? (u as any)?.portada?.url_publica ?? u?.portada?.path);
  }
}
