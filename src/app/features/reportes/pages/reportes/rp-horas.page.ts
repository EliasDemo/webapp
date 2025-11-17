import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { RpApiService } from '../../data-access/rp.api.service';
import { LookupsApiService } from '../../../vm/lookups/lookups.api';

import {
  ApiResponse,
  RpHorasFiltro,
  RpHorasPorPeriodoItem,
  RpHorasPorPeriodoMeta
} from '../../models/rp.models';

type PeriodoVM = { id: number; anio: number; ciclo: string; estado?: string };

@Component({
  standalone: true,
  selector: 'rp-horas-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './rp-horas.page.html',
})
export class RpHorasPage {
  // APIs
  private rpApi = inject(RpApiService);
  private lookups = inject(LookupsApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Estado base
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);

  // Ruta / selección (se llenará AUTO tras la 1ª consulta)
  epSedeId = signal<number | null>(null);
  epSedeNombre = signal<string | null>(null);

  // Para manejar 422 con choices (ids de EP-SEDE posibles)
  choices = signal<number[] | null>(null);

  // Filtros
  periodosOpciones = signal<string[]>([]);
  periodosActivos  = signal<Set<string>>(new Set());
  selectedPeriodos = signal<string[]>([]);
  ultimos = signal<number>(5);
  unidad  = signal<'h' | 'min'>('h');
  estado  = signal<'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'ANULADO'>('APROBADO');
  soloConHoras = signal<boolean>(true);
  orden  = signal<'apellidos' | 'codigo' | 'total'>('apellidos');
  dir    = signal<'asc' | 'desc'>('asc');

  // Datos
  meta   = signal<RpHorasPorPeriodoMeta | null>(null);
  items  = signal<RpHorasPorPeriodoItem[]>([]);
  periodosCols = signal<string[]>([]); // Columnas efectivas (incluye bucket_antes)

  // Derivados
  periodosTabla = computed<string[]>(() => this.periodosCols());
  totalGeneral = computed<number>(() => this.items().reduce((acc, it) => acc + (Number(it.total) || 0), 0));

  constructor() {
    // Si vino por ruta parametrizada, la respetamos como fallback
    const raw = this.route.snapshot.paramMap.get('epSedeId');
    const id = raw ? Number(raw) : NaN;
    if (!isNaN(id)) this.epSedeId.set(id);

    this.loadPeriodosOpciones();

    // Consulta inicial AUTO (si no hay id en ruta)
    this.consultar();
  }

  // ───────── Periodos (lookups) ─────────
  private loadPeriodosOpciones(): void {
    this.lookups.fetchPeriodos('', false, 100).subscribe({
      next: (arr: PeriodoVM[]) => {
        const opts = arr.map(p => `${p.anio}-${p.ciclo}`);
        const activos = new Set<string>(
          arr.filter(p => (p.estado || '').toUpperCase() === 'EN_CURSO').map(p => `${p.anio}-${p.ciclo}`)
        );
        opts.sort((a, b) => b.localeCompare(a));
        this.periodosOpciones.set(opts);
        this.periodosActivos.set(activos);
      },
      error: () => {
        this.periodosOpciones.set([]);
        this.periodosActivos.set(new Set());
      },
    });
  }

  isPeriodoActivo(code: string): boolean {
    return this.periodosActivos().has(code);
  }

  togglePeriodo(code: string, checked?: boolean): void {
    const set = new Set(this.selectedPeriodos());
    if (checked) set.add(code); else set.delete(code);
    this.selectedPeriodos.set(Array.from(set).sort((a, b) => b.localeCompare(a)));
  }

  clearPeriodos(): void {
    this.selectedPeriodos.set([]);
  }

  // ───────── Acciones ─────────
  consultar(): void {
    this.error.set(null);
    this.items.set([]);
    this.meta.set(null);
    this.choices.set(null);

    const filtro: RpHorasFiltro = {
      periodos: this.selectedPeriodos().length ? this.selectedPeriodos() : undefined,
      ultimos: this.selectedPeriodos().length ? undefined : this.ultimos(),
      unidad: this.unidad(),
      estado: this.estado(),
      solo_con_horas_periodos: this.soloConHoras(),
      orden: this.orden(),
      dir: this.dir(),
    };

    this.loading.set(true);

    const ep = this.epSedeId();
    const obs = ep
      ? this.rpApi.listarHorasPorPeriodo(ep, filtro)     // Parametrizado
      : this.rpApi.listarHorasPorPeriodoAuto(filtro);    // AUTO

    obs.subscribe({
      next: (resp: ApiResponse<RpHorasPorPeriodoItem[]>) => this.handleResponse(resp),
      error: (err) => {
        const msg = err?.error?.message || 'Error consultando el reporte.';
        this.error.set(msg);

        // choices (422)
        const ch = err?.error?.choices as number[] | undefined;
        if (Array.isArray(ch) && ch.length) this.choices.set(ch);
      },
      complete: () => this.loading.set(false),
    });
  }

  /** Normaliza el payload (con buckets) al formato que renderea la tabla. */
  private handleResponse(resp: ApiResponse<any>) {
    const meta = (resp?.meta ?? {}) as RpHorasPorPeriodoMeta;
    this.meta.set(meta);

    // Autocompletar EP desde meta cuando sea AUTO
    if ((meta as any)?.ep_sede_id != null) this.epSedeId.set(Number((meta as any).ep_sede_id));
    if ((meta as any)?.escuela_profesional) this.epSedeNombre.set(String((meta as any).escuela_profesional));

    // Columnas: bucket_antes (si existe) + orden de meta.periodos[].codigo
    const bucketAntes: string | null = ((meta as any)?.bucket_antes as string) || null;
    const periodosMeta: string[] = Array.isArray((meta as any)?.periodos)
      ? (meta as any).periodos.map((p: any) => (typeof p === 'string' ? p : String(p?.codigo))).filter(Boolean)
      : [];

    const cols: string[] = [
      ...(bucketAntes ? [bucketAntes] : []),
      ...periodosMeta
    ];
    this.periodosCols.set(cols);

    // Normalizar filas
    const items: RpHorasPorPeriodoItem[] = (resp?.data ?? []).map((r: any) => {
      const periodosRecord: Record<string, number> = {};
      cols.forEach(c => { periodosRecord[c] = Number(r?.buckets?.[c] ?? 0); });

      return {
        codigo: r?.codigo ?? '',
        apellidos: r?._last_name ?? '',
        nombres:   r?._first_name ?? '',
        total: Number(r?.total ?? 0),
        periodos: periodosRecord,
      } as RpHorasPorPeriodoItem;
    });

    this.items.set(items);
  }

  /** Si el backend devolvió choices (422), el usuario elige uno y reintentamos con path param. */
  seleccionarEpSede(id: number): void {
    this.epSedeId.set(id);
    this.consultar();
  }

  exportar(): void {
    const filtro: RpHorasFiltro = {
      periodos: this.selectedPeriodos().length ? this.selectedPeriodos() : undefined,
      ultimos: this.selectedPeriodos().length ? undefined : this.ultimos(),
      unidad: this.unidad(),
      estado: this.estado(),
      solo_con_horas_periodos: this.soloConHoras(),
      orden: this.orden(),
      dir: this.dir(),
    };

    this.loading.set(true);

    const ep = this.epSedeId();
    const obs = ep
      ? this.rpApi.exportarHorasPorPeriodo(ep, filtro)
      : this.rpApi.exportarHorasPorPeriodoAuto(filtro);

    obs.subscribe({
      next: (blob: Blob) => {
        const file = `reporte_horas_ep_${ep ?? 'auto'}.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo descargar el Excel.');
      },
      complete: () => this.loading.set(false),
    });
  }

  // 📥 Descargar plantilla (usa el nuevo método del servicio)
  descargarPlantilla(): void {
    this.loading.set(true);
    this.rpApi.descargarPlantillaHorasHistoricas().subscribe({
      next: (blob) => {
        const file = 'plantilla_horas_historicas.xlsx';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo descargar la plantilla.');
      },
      complete: () => this.loading.set(false),
    });
  }

  // ↗️ Ir a la pantalla de importación (ajusta la ruta si la defines distinta)
  irAImportar(): void {
    this.router.navigate(['/r/import/historico-horas']);
  }




  // ───────── CSV local ─────────
  exportarLocalCSV(): void {
    const rows = this.items();
    if (!rows.length) return;

    const periodos = this.periodosTabla();
    const headers = ['codigo','apellidos','nombres', ...periodos, 'total'];

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines: string[] = [];
    lines.push(headers.join(','));

    rows.forEach((r) => {
      const row = [
        r.codigo ?? '',
        r.apellidos ?? '',
        r.nombres ?? '',
        ...periodos.map(p => r.periodos[p] ?? 0),
        r.total ?? 0
      ].map(escape);
      lines.push(row.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reporte_horas.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  limpiar(): void {
    this.selectedPeriodos.set([]);
    this.ultimos.set(5);
    this.unidad.set('h');
    this.estado.set('APROBADO');
    this.soloConHoras.set(true);
    this.orden.set('apellidos');
    this.dir.set('asc');
    this.items.set([]);
    this.meta.set(null);
    this.error.set(null);
    this.choices.set(null);
  }

  // Helpers
  isLoadingDisabled(): boolean { return this.loading(); }
  trackByStr = (_: number, s: string) => s;
  trackItem = (_: number, r: RpHorasPorPeriodoItem) =>
    r.persona_id ?? `${r.codigo}-${r.apellidos}-${r.nombres}`;
}
