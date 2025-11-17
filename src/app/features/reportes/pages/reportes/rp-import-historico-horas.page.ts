import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RpApiService } from '../../data-access/rp.api.service';
import {
  VmImportHorasHistoricasResponse,
  VmImportHorasHistoricasStatus,
  VmImportHorasHistoricasSummary,
  VmImportHorasHistoricasError,
} from '../../models/rp.models';

@Component({
  standalone: true,
  selector: 'rp-import-historico-horas-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './rp-import-historico-horas.page.html',
})
export class RpImportHistoricoHorasPage {
  private rpApi = inject(RpApiService);

  // Estado base
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);

  // Parámetros
  epSedeId = signal<number | null>(null);
  replace  = signal<boolean>(false);
  ultimos  = signal<number>(6);

  // Archivo
  file = signal<File | null>(null);

  // Estado backend
  status  = signal<VmImportHorasHistoricasStatus | null>(null);
  summary = signal<VmImportHorasHistoricasSummary | null>(null);
  errores = signal<VmImportHorasHistoricasError[]>([]);

  hasStatus    = computed(() => !!this.status());
  hasResultado = computed(() => !!this.summary() || this.errores().length > 0);

  constructor() {
    this.cargarStatus();
  }

  // ───────── File input ─────────
  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.file.set(files && files.length ? files[0] : null);
  }

  // ───────── Status ─────────
  cargarStatus(): void {
    this.loading.set(true);
    this.error.set(null);

    this.rpApi
      .consultarEstadoHorasHistoricas(this.epSedeId() ?? undefined)
      .subscribe({
        next: (res) => {
          this.status.set(res);
        },
        error: (err) => {
          this.error.set(
            err?.error?.message ||
              'No se pudo obtener el estado de horas históricas.',
          );
        },
        complete: () => this.loading.set(false),
      });
  }

  // ───────── Descargar plantilla ─────────
  descargarPlantilla(): void {
    this.loading.set(true);
    this.error.set(null);

    this.rpApi
      .descargarPlantillaHorasHistoricas({ ultimos: this.ultimos() })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'plantilla_horas_historicas.xlsx';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.error.set(
            err?.error?.message || 'No se pudo descargar la plantilla.',
          );
        },
        complete: () => this.loading.set(false),
      });
  }

  // ───────── Importar ─────────
  importar(): void {
    const file = this.file();
    if (!file) {
      this.error.set('Selecciona un archivo Excel antes de importar.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.summary.set(null);
    this.errores.set([]);

    this.rpApi
      .importarHorasHistoricas(file, {
        ep_sede_id: this.epSedeId() ?? undefined,
        replace: this.replace(),
      })
      .subscribe({
        next: (res: VmImportHorasHistoricasResponse) => {
          if (!res.ok) {
            this.error.set('La importación devolvió un estado no OK.');
          }
          this.summary.set(res.summary ?? null);
          this.errores.set(
            (res.errors as VmImportHorasHistoricasError[]) ?? [],
          );
        },
        error: (err) => {
          this.error.set(
            err?.error?.message || 'No se pudo completar la importación.',
          );
        },
        complete: () => {
          this.loading.set(false);
          this.cargarStatus();
        },
      });
  }

  limpiarResultado(): void {
    this.summary.set(null);
    this.errores.set([]);
    this.error.set(null);
    this.file.set(null); // 👈 también limpiamos el archivo seleccionado
  }

  // Helpers template
  trackError = (_: number, e: VmImportHorasHistoricasError) =>
    e.row ?? e.codigo ?? e.reason ?? Math.random();
}
