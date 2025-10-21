// src/app/features/matriculas/pages/manual/search/m-manual-search.page.ts
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatriculaManualApiService } from '../../../data-access/m-manual.api';
import { ManualBuscarResponse } from '../../../models/m-manual.models';

@Component({
  standalone: true,
  selector: 'm-manual-search-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './m-manual-search.page.html',
})
export class MManualSearchPage {
  private api = inject(MatriculaManualApiService);
  private router = inject(Router);

  // Filtros
  codigo = signal<string>('');
  documento = signal<string>('');
  email = signal<string>('');

  // Estado
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<any | null>(null);

  buscar(): void {
    // Validar que al menos un campo tenga contenido
    if (!this.codigo() && !this.documento() && !this.email()) {
      this.error.set('Por favor, ingresa al menos un criterio de búsqueda.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);

    this.api.buscar({
      codigo: this.codigo().trim(),
      documento: this.documento().trim(),
      email: this.email().trim()
    }).subscribe({
      next: (res: ManualBuscarResponse) => {
        if (res.ok) {
          this.data.set(res.data);
        } else {
          this.error.set(res.message || 'No se encontraron estudiantes con los criterios proporcionados.');
        }
      },
      error: (e: any) => {
        this.error.set(e?.error?.message || 'Error de conexión. Por favor, intenta nuevamente.');
      },
      complete: () => this.loading.set(false),
    });
  }

  limpiar(): void {
    this.codigo.set('');
    this.documento.set('');
    this.email.set('');
    this.data.set(null);
    this.error.set(null);
  }

  irRegistrar(): void {
    const d = this.data();
    const query: any = {};
    if (d?.expediente?.codigo_estudiante) query.codigo = d.expediente.codigo_estudiante;
    this.router.navigate(['/m/manual/registrar'], { queryParams: query });
  }

  irMatricular(): void {
    const d = this.data();
    const query: any = {};
    if (d?.expediente?.id) query.expedienteId = d.expediente.id;
    if (d?.expediente?.codigo_estudiante) query.codigo = d.expediente.codigo_estudiante;
    this.router.navigate(['/m/manual/matricular'], { queryParams: query });
  }
}
