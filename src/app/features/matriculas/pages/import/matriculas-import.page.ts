import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatriculaApiService } from '../../data-access/m.api';
import {
  MatriculaImportOk,
  MatriculaImportResponse,
  MatriculaImportRow,
  MatriculaImportSummary,
  Id,
} from '../../models/m.models';

import { LookupsApiService } from '../../../vm/lookups/lookups.api';

type PeriodoVM = { id: number; anio: number; ciclo: string; estado?: string };

@Component({
  standalone: true,
  selector: 'matriculas-import-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './matriculas-import.page.html',
})
export class MatriculasImportPage {
  // APIs
  private api = inject(MatriculaApiService);
  private lookups = inject(LookupsApiService);

  // Estado base
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);

  // Progreso (0–100)
  progress = signal<number>(0);
  private progressTimer: any = null;

  // Formulario
  periodos = signal<PeriodoVM[]>([]);
  selectedPeriodoId = signal<number | null>(null);

  // No se muestra en el form, pero se usa si el backend devuelve 'choices'
  epSedeId = signal<number | null>(null);

  archivo = signal<File | null>(null);

  // Drag & drop
  over = signal<boolean>(false);

  // Respuesta
  summary = signal<MatriculaImportSummary | null>(null);
  rows    = signal<MatriculaImportRow[]>([]);
  choices = signal<Id[] | null>(null); // EP-SEDEs sugeridas por backend

  // Derivados
  selectedPeriodo = computed<PeriodoVM | null>(() => {
    const id = this.selectedPeriodoId();
    return this.periodos().find((p: PeriodoVM) => p.id === id) ?? null;
  });

  totalOk = computed<number>(() =>
    this.rows().filter((r: MatriculaImportRow) => r.status === 'ok').length
  );
  totalError = computed<number>(() =>
    this.rows().filter((r: MatriculaImportRow) => r.status === 'error').length
  );

  archivoNombre = computed<string>(() => this.archivo()?.name ?? '—');
  archivoPesoKB = computed<number>(() => {
    const f = this.archivo();
    return f ? Math.round(f.size / 1024) : 0;
  });

  constructor() { this.loadPeriodos(); }

  // ========= Periodos =========
  private loadPeriodos(): void {
    this.lookups.fetchPeriodos('', false, 50).subscribe({
      next: (arr: PeriodoVM[]) => {
        const ordered = [...arr].sort((a, b) => {
          const ak = `${String(a.anio).padStart(4,'0')}-${String(a.ciclo).padStart(2,'0')}`;
          const bk = `${String(b.anio).padStart(4,'0')}-${String(b.ciclo).padStart(2,'0')}`;
          return bk.localeCompare(ak);
        });
        this.periodos.set(ordered);
        const actual = ordered.find(p => (p.estado || '').toUpperCase() === 'EN_CURSO');
        if (actual) this.selectedPeriodoId.set(actual.id);
      },
      error: () => this.periodos.set([]),
    });
  }

  // ========= Acciones UI =========
  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    this.setFile(f);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.over.set(false);
    if (!ev.dataTransfer) return;
    const files = ev.dataTransfer.files;
    if (files && files.length > 0) this.setFile(files[0]);
  }

  onDragOver(ev: DragEvent): void { ev.preventDefault(); this.over.set(true); }
  onDragLeave(ev: DragEvent): void { ev.preventDefault(); this.over.set(false); }

  private setFile(f: File | null): void {
    if (!f) { this.archivo.set(null); return; }
    const okType = /(\.xlsx|\.xls|\.csv)$/i.test(f.name);
    if (!okType) {
      this.error.set('El archivo debe ser .xlsx, .xls o .csv');
      this.archivo.set(null);
      return;
    }
    this.error.set(null);
    this.archivo.set(f);
  }

  descargarPlantilla(): void {
    // GET /api/matriculas/plantilla
    this.api.descargarPlantilla().subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_matriculas.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        this.error.set(err?.error?.message || 'No se pudo descargar la plantilla.');
      }
    });
  }

  limpiar(): void {
    this.archivo.set(null);
    this.summary.set(null);
    this.rows.set([]);
    this.error.set(null);
    this.choices.set(null);
    this.epSedeId.set(null);
    this.progress.set(0);
    this.clearFakeProgress();
  }

  importar(): void {
    this.error.set(null);
    this.summary.set(null);
    this.rows.set([]);
    this.choices.set(null);

    const periodoId = this.selectedPeriodoId();
    const file = this.archivo();
    const epSede = this.epSedeId();

    if (!periodoId) { this.error.set('Selecciona un período académico.'); return; }
    if (!file) { this.error.set('Selecciona o arrastra un archivo Excel.'); return; }

    this.loading.set(true);
    this.progress.set(0);
    this.startFakeProgress();

    this.api.importarMatriculas({
      periodo_id: periodoId,
      ep_sede_id: epSede ?? undefined,
      file,
    }).subscribe({
      next: (res: MatriculaImportResponse) => {
        if (res.ok === true) {
          const ok = res as MatriculaImportOk;
          this.summary.set(ok.summary);
          this.rows.set(ok.rows ?? []);
        } else {
          this.error.set((res as any)?.message || 'No se pudo procesar el archivo.');
          const ch = (res as any)?.choices as Id[] | undefined;
          if (Array.isArray(ch) && ch.length) this.choices.set(ch);
        }
        // cuando llega respuesta, llevamos el progreso al 100%
        this.progress.set(100);
      },
      error: (err: any) => {
        this.error.set(err?.error?.message || 'Error de red al importar.');
        this.loading.set(false);
        this.progress.set(0);
        this.clearFakeProgress();
      },
      complete: () => {
        this.loading.set(false);
        // si por alguna razón no se puso en 100 en next, lo forzamos aquí
        if (this.progress() < 100 && !this.error()) {
          this.progress.set(100);
        }
        this.clearFakeProgress();
      },
    });
  }

  // ========= Helpers de progreso =========
  private startFakeProgress(): void {
    this.clearFakeProgress();
    this.progress.set(5);

    this.progressTimer = setInterval(() => {
      if (!this.loading()) {
        this.clearFakeProgress();
        return;
      }
      const current = this.progress();
      // sube lentamente hasta 90%, el resto se completa al recibir la respuesta
      if (current < 90) {
        this.progress.set(current + 3);
      }
    }, 400);
  }

  private clearFakeProgress(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  // ========= Helpers UI =========
  chipStatusClass(status: 'ok' | 'error'): string {
    return status === 'ok'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700';
  }

  headerEstadoBadge(): string { return 'bg-slate-100 text-slate-700 border-slate-200'; }

  // trackBy para tabla
  trackRow = (_: number, r: MatriculaImportRow) => r.row;

  exportarCSV(): void {
    const rows = this.rows();
    if (!rows.length) return;

    const headers = [
      'row','status','message',
      'user_id','expediente_id','matricula_id',
      'usuario','email','estudiante','documento','correo_institucional',
      'codigo_estudiante','ciclo','grupo','modalidad_estudio','modo_contrato',
      'fecha_matricula','fecha_matricula_raw','pais','pais_iso2'
    ];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines: string[] = [];
    lines.push(headers.join(','));

    rows.forEach((r: MatriculaImportRow) => {
      const d = r.data || {};
      const ids = r.ids || {};
      const rowData = [
        r.row,
        r.status,
        r.message,
        (ids as any).user_id ?? '',
        (ids as any).expediente_id ?? '',
        (ids as any).matricula_id ?? '',
        (d as any).usuario ?? '',
        (d as any).email ?? '',
        (d as any).estudiante ?? '',
        (d as any).documento ?? '',
        (d as any).correo_institucional ?? '',
        (d as any).codigo_estudiante ?? '',
        (d as any).ciclo ?? '',
        (d as any).grupo ?? '',
        (d as any).modalidad_estudio ?? '',
        (d as any).modo_contrato ?? '',
        (d as any).fecha_matricula ?? '',
        (d as any).fecha_matricula_raw ?? '',
        (d as any).pais ?? '',
        (d as any).pais_iso2 ?? '',
      ].map(escape);
      lines.push(rowData.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resultado_import_matriculas.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}
