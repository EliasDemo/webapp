import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdApiService } from '../../data-access/ad-api.service';
import { Universidad } from '../../models/ad.models';

type FormState = { codigo: string; nombre: string };

@Component({
  standalone: true,
  selector: 'app-facultad-create-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './facultad-create.page.html',
  styleUrls: ['./facultad-create.page.scss'],
})
export class FacultadCreatePage {
  private api = inject(AdApiService);
  private router = inject(Router);

  uniId = signal<number | null>(null);
  form  = signal<FormState>({ codigo: '', nombre: '' });

  loading = signal(false);
  error   = signal<string | null>(null);

  constructor() { void this.bootstrap(); }

  async bootstrap() {
    try {
      const u = await firstValueFrom(this.api.obtenerUniversidad());
      const uni = u.data as Universidad;
      this.uniId.set(uni?.id ?? null);
    } catch {
      this.error.set('No se pudo obtener la universidad');
    }
  }

  set<K extends keyof FormState>(k: K, v: FormState[K]) {
    this.form.update(f => ({ ...f, [k]: v }));
  }

  async guardar() {
    if (!this.uniId()) { this.error.set('Universidad no definida'); return; }
    const f = this.form();
    if (!f.codigo.trim() || !f.nombre.trim()) {
      this.error.set('Completa código y nombre');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.crearFacultad({
        universidad_id: this.uniId()!,
        codigo: f.codigo.trim(),
        nombre: f.nombre.trim(),
      }));
      this.router.navigate(['/ad/sedes']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo crear la facultad');
    } finally {
      this.loading.set(false);
    }
  }

  volver() { this.router.navigate(['/ad/sedes']); }
}
