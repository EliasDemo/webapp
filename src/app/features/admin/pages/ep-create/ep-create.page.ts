import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdApiService } from '../../data-access/ad-api.service';
import { Facultad } from '../../models/ad.models';

type FormState = { codigo: string; nombre: string; facultad_id: number | null };

@Component({
  standalone: true,
  selector: 'app-ep-create-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './ep-create.page.html',
  styleUrls: ['./ep-create.page.scss'],
})
export class EpCreatePage {
  private api = inject(AdApiService);
  private router = inject(Router);

  form = signal<FormState>({ codigo: '', nombre: '', facultad_id: null });

  loading = signal(false);
  error   = signal<string | null>(null);

  facs = signal<Facultad[]>([]);

  constructor() { void this.bootstrap(); }

  async bootstrap() {
    try {
      const rf = await firstValueFrom(this.api.listarFacultades(undefined, 1, 500));
      this.facs.set(rf.data?.items ?? []);
    } catch {
      this.error.set('No se pudieron cargar las facultades');
    }
  }

  set<K extends keyof FormState>(k: K, v: FormState[K]) {
    this.form.update(f => ({ ...f, [k]: v }));
  }

  async guardar() {
    const f = this.form();
    if (!f.codigo.trim() || !f.nombre.trim() || !f.facultad_id) {
      this.error.set('Completa código, nombre y selecciona facultad');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.crearEscuela({
        facultad_id: f.facultad_id,
        codigo: f.codigo.trim(),
        nombre: f.nombre.trim(),
      }));
      this.router.navigate(['/ad/sedes']);
    } catch (e: any) {
      this.error.set(e?.error?.message ?? 'No se pudo crear la escuela profesional');
    } finally {
      this.loading.set(false);
    }
  }

  volver() { this.router.navigate(['/ad/sedes']); }

  trackByFac = (_: number, fac: Facultad) => fac.id;

  // Ejemplos de EP para mostrar
  ejemplosEP() {
    return [
      { codigo: 'DER', nombre: 'Derecho', facultad: 'Facultad de Derecho' },
      { codigo: 'MED', nombre: 'Medicina', facultad: 'Facultad de Medicina' },
      { codigo: 'ADM', nombre: 'Administración', facultad: 'Facultad de Ciencias Empresariales' },
      { codigo: 'ING', nombre: 'Ingeniería Civil', facultad: 'Facultad de Ingeniería' }
    ];
  }

  // Usar ejemplo
  usarEjemplo(ejemplo: any) {
    this.set('codigo', ejemplo.codigo);
    this.set('nombre', ejemplo.nombre);
    // Aquí buscarías el ID de facultad correspondiente
  }

  // Obtener nombre de facultad para vista previa
  getFacultadNombre() {
    const facId = this.form().facultad_id;
    const facultad = this.facs().find(f => f.id === facId);
    return facultad ? facultad.nombre : '';
  }
}
