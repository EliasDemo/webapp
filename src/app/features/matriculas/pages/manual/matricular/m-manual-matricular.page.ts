// src/app/features/matriculas/pages/manual/matricular/m-manual-matricular.page.ts
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatriculaManualApiService } from '../../../data-access/m-manual.api';
import { MatricularPayload, MatricularResponse, ManualBuscarResponse } from '../../../models/m-manual.models';
import { LookupsApiService } from '../../../../vm/lookups/lookups.api';

type PeriodoVM = { id: number; anio: number; ciclo: string; estado?: string };

@Component({
  standalone: true,
  selector: 'm-manual-matricular-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './m-manual-matricular.page.html',
})
export class MManualMatricularPage {
  private api = inject(MatriculaManualApiService);
  private lookups = inject(LookupsApiService);
  private route = inject(ActivatedRoute);

  periodos = signal<PeriodoVM[]>([]);
  form = signal<MatricularPayload>({
    codigo_estudiante: null,
    expediente_id: null,
    periodo_id: 0,
    ciclo: null,
    grupo: null,
    modalidad_estudio: null,
    modo_contrato: null,
    fecha_matricula: null
  });

  loading = signal(false);
  error = signal<string | null>(null);
  okMsg = signal<string | null>(null);
  alumnoCard = signal<{nombre?: string; codigo?: string; doc?: string} | null>(null);

  constructor() {
    // Prefill from query
    const q = this.route.snapshot.queryParamMap;
    const expedienteId = q.get('expedienteId');
    const codigo = q.get('codigo');
    if (expedienteId) this.patch({ expediente_id: +expedienteId });
    if (codigo) {
      this.patch({ codigo_estudiante: codigo });
      queueMicrotask(() => this.cargarPorCodigo());
    }

    // Load periods
    this.lookups.fetchPeriodos('', false, 50).subscribe({
      next: (arr: PeriodoVM[]) => {
        const ordered = [...arr].sort((a, b) => `${b.anio}-${b.ciclo}`.localeCompare(`${a.anio}-${a.ciclo}`));
        this.periodos.set(ordered);
        const actual = ordered.find(p => (p.estado || '').toUpperCase() === 'EN_CURSO');
        if (actual) this.patch({ periodo_id: actual.id });
      },
      error: () => this.periodos.set([]),
    });
  }

  patch(partial: Partial<MatricularPayload>) {
    this.form.update(v => ({ ...v, ...partial }));
  }

  cargarPorCodigo(): void {
    const cod = (this.form().codigo_estudiante || '').trim();
    if (!cod) return;

    this.loading.set(true);
    this.error.set(null);
    this.okMsg.set(null);

    this.api.buscar({ codigo: cod }).subscribe({
      next: (res: ManualBuscarResponse) => {
        // Narrowing explícito
        if (!res.ok) {
          this.error.set(res.message || 'No se encontró el expediente.');
          this.alumnoCard.set(null);
          return;
        }

        const u = res.data.user || {};
        const e = res.data.expediente || {};
        const ms = Array.isArray(res.data.matriculas) ? res.data.matriculas : [];
        const last = ms[0] || null; // backend las retorna desc por periodo_id

        this.patch({
          expediente_id: e.id ?? null,
          ciclo: e.ciclo ?? null,
          grupo: e.grupo ?? null,
          modalidad_estudio: last?.modalidad_estudio ?? null,
          modo_contrato: last?.modo_contrato ?? null,
        });

        this.alumnoCard.set({
          nombre: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          codigo: e.codigo_estudiante || cod,
          doc: u.doc_numero || '—',
        });

        this.okMsg.set('Expediente encontrado. Campos precargados.');
      },
      error: (e: any) => this.error.set(e?.error?.message || 'Error de red.'),
      complete: () => this.loading.set(false),
    });
  }

  enviar(): void {
    if (!this.form().periodo_id) { this.error.set('Selecciona un período.'); return; }
    this.loading.set(true); this.error.set(null); this.okMsg.set(null);

    this.api.matricular(this.form()).subscribe({
      next: (res: MatricularResponse) => {
        if (res.ok) this.okMsg.set(res.message || 'Operación realizada.');
        else this.error.set(res.message || 'No se pudo procesar.');
      },
      error: (e: any) => this.error.set(e?.error?.message || 'Error de red.'),
      complete: () => this.loading.set(false),
    });
  }

  anular(): void {
    this.patch({ fecha_matricula: null });
    this.enviar();
  }

  // 👇 Agrega este método para que el (click)="limpiarFormulario()" del template funcione
  limpiarFormulario(): void {
    const periodoActual = this.form().periodo_id || 0; // preserva el período elegido
    this.form.set({
      codigo_estudiante: null,
      expediente_id: null,
      periodo_id: periodoActual,
      ciclo: null,
      grupo: null,
      modalidad_estudio: null,
      modo_contrato: null,
      fecha_matricula: null
    });
    this.alumnoCard.set(null);
    this.okMsg.set(null);
    this.error.set(null);
  }
}
