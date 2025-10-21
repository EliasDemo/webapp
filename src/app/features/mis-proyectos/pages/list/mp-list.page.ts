import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { VmApiService } from '../../../vm/data-access/vm.api';
import {
  VmProyecto,
  ProyectosAlumnoData,
  AlumnoProyectoAgenda,
  EnrolResponse,
  ApiResponse,
} from '../../../vm/models/proyecto.models';

import { HorasApiService } from '../../../hours/data-access/h.api';
import { ReporteHorasOk } from '../../../hours/models/h.models';
import { LookupsApiService } from '../../../vm/lookups/lookups.api';

type PeriodoVM = { id: number; anio: number; ciclo: string; estado?: string };

@Component({
  standalone: true,
  selector: 'mp-list-page',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './mp-list.page.html',
  styleUrls: ['./mp-list.page.scss'],
})
export class MpListPage {
  // APIs
  private api = inject(VmApiService);
  private horasApi = inject(HorasApiService);
  private lookups = inject(LookupsApiService);

  // Estado base
  loading = signal(true);
  error   = signal<string | null>(null);

  // Tabs
  activeTab = signal<'periodo' | 'historial'>('periodo');

  // Períodos
  periodos = signal<PeriodoVM[]>([]);
  selectedPeriodoId = signal<number | null>(null);
  private reqId = 0;

  // Datos
  ctx = signal<ProyectosAlumnoData['contexto'] | null>(null);
  dataAlumno = signal<ProyectosAlumnoData | null>(null);
  agenda = signal<AlumnoProyectoAgenda[] | null>(null);

  // Progreso (horas hechas por proyecto, en HORAS)
  horasPorProyecto = signal<Map<number, number>>(new Map());

  // Historial por período
  historiales = signal<VmProyecto[]>([]);

  // ======== Derivados de período ========
  selectedPeriodo = computed<PeriodoVM | null>(() => {
    const id = this.selectedPeriodoId();
    return this.periodos().find(p => p.id === id) ?? null;
  });

  periodoCodigo = computed(() => {
    const p = this.selectedPeriodo();
    if (p) return `${p.anio}-${p.ciclo}`;
    return this.ctx()?.periodo_codigo ?? '—';
  });

  selectedPeriodoIsActual = computed(() =>
    (this.selectedPeriodo()?.estado || '').toUpperCase() === 'EN_CURSO'
  );

  // ======== Helpers de proyecto ========
  private isClosed(p?: VmProyecto | null): boolean {
    const e = (p?.estado || '').toUpperCase();
    return e === 'CERRADO' || e === 'CANCELADO' || e === 'FINALIZADO';
  }
  private isActive(p?: VmProyecto | null): boolean {
    const e = (p?.estado || '').toUpperCase();
    return e === 'PLANIFICADO' || e === 'EN_CURSO';
  }
  private uniqById(arr: VmProyecto[]): VmProyecto[] {
    const map = new Map<number, VmProyecto>();
    arr.forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  }

  // Map: proyectoId -> periodo_id (para fallback de historial)
  agendaPeriodMap = computed(() => {
    const m = new Map<number, number | null>();
    for (const a of (this.agenda() ?? [])) {
      const pid = (a as any)?.periodo_id ?? (a as any)?.periodo?.id ?? null;
      if (a?.proyecto?.id != null) m.set(a.proyecto.id, pid);
    }
    return m;
  });

  // ======== Listas ========
  inscritos = computed<VmProyecto[]>(() => {
    const ag = (this.agenda() ?? []).map(a => a.proyecto);
    const pend = (this.dataAlumno()?.pendientes ?? []).map(p => p.proyecto);
    const base = this.uniqById([...ag, ...pend]);
    return base.filter((p: VmProyecto) => this.isActive(p));
  });

  private insIds = computed<Set<number>>(() => new Set(this.inscritos().map(p => p.id)));

  vinculados = computed<VmProyecto[]>(() => {
    const src = (
      this.dataAlumno()?.inscribibles ??
      (this.dataAlumno() as any)?.inscribibles_prioridad ??
      []
    ) as VmProyecto[];
    const ids = this.insIds();
    return src.filter((p: VmProyecto) => this.isActive(p) && !ids.has(p.id));
  });

  libres = computed<VmProyecto[]>(() => {
    const src = (this.dataAlumno()?.libres ?? []) as VmProyecto[];
    const ids = this.insIds();
    return src.filter((p: VmProyecto) => this.isActive(p) && !ids.has(p.id));
  });

  // KPIs
  inscritosCount   = computed(() => this.inscritos().length);
  vinculadosCount  = computed(() => this.vinculados().length);
  libresCount      = computed(() => this.libres().length);
  historialesCount = computed(() => this.historiales().length);

  // Contexto: ciclo actual y pendiente
  cicloActual     = computed(() => this.ctx()?.ciclo_actual ?? (this.ctx() as any)?.nivel_objetivo ?? null);
  tienePendiente  = computed(() => this.ctx()?.tiene_pendiente_vinculado ?? false);

  constructor() { this.initPeriodosAndLoad(); }

  // ========= Períodos =========
  private initPeriodosAndLoad() {
    this.loading.set(true);
    this.loadPeriodos(() => this.loadAll());
  }

  private loadPeriodos(onDone?: () => void) {
    this.lookups.fetchPeriodos('', false, 50).subscribe({
      next: (arr) => {
        const ordered = [...arr].sort((a, b) => {
          const ak = `${String(a.anio).padStart(4,'0')}-${String(a.ciclo).padStart(2,'0')}`;
          const bk = `${String(b.anio).padStart(4,'0')}-${String(b.ciclo).padStart(2,'0')}`;
          return bk.localeCompare(ak);
        });
        this.periodos.set(ordered);
        const actual = ordered.find(p => (p.estado || '').toUpperCase() === 'EN_CURSO');
        if (actual) this.selectedPeriodoId.set(actual.id);
      },
      error: () => { this.periodos.set([]); },
      complete: () => { onDone?.(); }
    });
  }

  onPeriodoChange(id: number | null) {
    if (id === this.selectedPeriodoId()) return;
    this.selectedPeriodoId.set(id);
    this.activeTab.set('periodo');
    this.scrollTop();
    this.clearStateForReload();
    this.loadAll();
  }

  // ========= Carga =========
  private clearStateForReload() {
    this.error.set(null);
    this.dataAlumno.set(null);
    this.agenda.set(null);
    this.horasPorProyecto.set(new Map());
    this.historiales.set([]);
  }

  private scrollTop() {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }

  loadAll() {
    this.loading.set(true);
    const thisReq = ++this.reqId;
    const periodoId = this.selectedPeriodoId() ?? undefined;

    // 1) Proyectos alumno
    this.api.listarProyectosAlumno({ periodo_id: periodoId }).subscribe({
      next: (res: ApiResponse<ProyectosAlumnoData>) => {
        if (this.reqId !== thisReq) return;
        if ((res as any)?.ok !== true) {
          this.error.set((res as any)?.message || 'No se pudo cargar tus proyectos');
          return;
        }
        const data = (res as any).data as ProyectosAlumnoData;
        this.dataAlumno.set(data);
        this.ctx.set(data.contexto ?? null);

        if (this.selectedPeriodoId() == null && data?.contexto?.periodo_id != null) {
          this.selectedPeriodoId.set(data.contexto.periodo_id);
        }
      },
      error: () => { if (this.reqId === thisReq) this.error.set('No se pudo cargar tus proyectos'); },
      complete: () => {
        if (this.reqId !== thisReq) return;

        // 2) Agenda (inscritos del período)
        this.api.obtenerAgendaAlumno({ periodo_id: this.selectedPeriodoId() ?? undefined }).subscribe({
          next: (res) => {
            if (this.reqId !== thisReq) return;
            if ((res as any)?.ok !== true) { this.agenda.set([]); return; }
            this.agenda.set((res as any).data ?? []);
          },
          error: () => { if (this.reqId === thisReq) this.agenda.set([]); },
          complete: () => {
            if (this.reqId !== thisReq) return;

            // --- Esperamos HORAS y HISTORIAL ---
            let pending = 2;
            const done = () => { if (--pending <= 0 && this.reqId === thisReq) this.loading.set(false); };

            // 3) Horas por proyecto (todas las horas: estado='*')
            this.fetchHorasProyectos(this.selectedPeriodoId() ?? undefined, thisReq, done);

            // 4) Historial (vinculados históricos + libres cerrados)
            this.fetchHistorial(this.selectedPeriodoId() ?? undefined, thisReq, done);
          }
        });
      }
    });
  }

  // ======== Horas por proyecto ========
  private fetchHorasProyectos(periodoId: number | undefined, thisReq: number, onDone: () => void) {
    this.horasApi.obtenerMiReporteHoras({
      tipo: 'vm_proyecto',
      periodo_id: periodoId,
      estado: '*',
      per_page: 1,
    }).subscribe({
      next: (r) => {
        if (this.reqId !== thisReq) return;
        if ((r as any)?.ok === true) {
          const ok = r as ReporteHorasOk;
          const map = new Map<number, number>();
          for (const it of ok.data.resumen?.por_vinculo ?? []) {
            if (it.tipo === 'vm_proyecto') {
              const horas = typeof it.horas === 'number'
                ? it.horas
                : (typeof (it as any).minutos === 'number' ? (it as any).minutos / 60 : 0);
              map.set(Number(it.id), +horas.toFixed(2));
            }
          }
          this.horasPorProyecto.set(map);
        } else {
          this.horasPorProyecto.set(new Map());
        }
      },
      error: () => { if (this.reqId === thisReq) this.horasPorProyecto.set(new Map()); },
      complete: onDone
    });
  }

  // ======== Historial (ACTUALIZADO) ========
  private fetchHistorial(_periodoId: number | undefined, thisReq: number, onDone: () => void) {
    try {
      if (this.reqId !== thisReq) return;

      // Después (filtramos cerrados)
      const vincHistAll = (this.dataAlumno()?.vinculados_historicos ?? []) as VmProyecto[];
      const vincHistCerrados = vincHistAll.filter((p: VmProyecto) => this.isClosed(p));
      const libresCerrados = (this.dataAlumno()?.libres ?? []).filter((p: VmProyecto) => this.isClosed(p));
      const merged = this.uniqById([...vincHistCerrados, ...libresCerrados]);


      const pidSel = this.selectedPeriodoId();
      const filtered = merged.filter((p: VmProyecto) => (pidSel == null) ? true : (p as any)?.periodo_id === pidSel);

      this.historiales.set(filtered);
    } catch {
      this.historiales.set(this.buildFallbackHistorial());
    } finally {
      onDone();
    }
  }

  // Fallback: agenda + pendientes, solo CERRADOS del período seleccionado
  private buildFallbackHistorial(): VmProyecto[] {
    const periodId = this.selectedPeriodoId();
    const periodMap = this.agendaPeriodMap(); // proyectoId -> periodo_id
    const ag = (this.agenda() ?? []).map(a => a.proyecto);
    const pend = (this.dataAlumno()?.pendientes ?? []).map(p => p.proyecto);
    const base = this.uniqById([...ag, ...pend]);
    return base.filter((p: VmProyecto) => {
      if (!this.isClosed(p)) return false;
      const pid = periodMap.get(p.id) ?? (p as any)?.periodo_id ?? null;
      return periodId == null ? true : pid === periodId;
    });
  }

  // ======== UI: progreso ========
  getHorasHechas(p: VmProyecto): number { return this.horasPorProyecto().get(p.id) ?? 0; }
  getHorasPlan(p: VmProyecto): number { return Math.max(0, Number(p.horas_planificadas ?? 0)); }
  getFaltantes(p: VmProyecto): number { return +Math.max(0, this.getHorasPlan(p) - this.getHorasHechas(p)).toFixed(2); }
  getOverflow(p: VmProyecto): number  { return +Math.max(0, this.getHorasHechas(p) - this.getHorasPlan(p)).toFixed(2); }
  getProgresoPct(p: VmProyecto): number {
    const plan = this.getHorasPlan(p);
    if (plan <= 0) return 0;
    return Math.max(0, Math.min(100, +((this.getHorasHechas(p) / plan) * 100).toFixed(1)));
    }
  getProgressRailClasses(p: VmProyecto): string {
    const falt = this.getFaltantes(p);
    const e = (p.estado || '').toUpperCase();
    if (falt > 0 && (e === 'CERRADO' || e === 'CANCELADO' || e === 'FINALIZADO')) return 'bg-rose-100';
    if (falt > 0 && e === 'EN_CURSO') return 'bg-amber-100';
    return 'bg-slate-100';
  }
  getProgressFillClasses(_p: VmProyecto): string {
    return 'bg-emerald-500';
  }

  // ======== CTA ========
  inscribirse(proyecto: VmProyecto | number) {
    const proyectoId = typeof proyecto === 'number' ? proyecto : proyecto.id;
    this.api.inscribirseProyecto(proyectoId).subscribe({
      next: (r: EnrolResponse) => {
        if ((r as any)?.ok === true) {
          alert('¡Inscripción exitosa!');
          this.clearStateForReload();
          this.loadAll();
        } else {
          const body = r as any;
          alert(`Error: ${body?.message || 'No se pudo inscribirse.'}`);
        }
      },
      error: (err) => {
        alert(err?.error?.message || 'Error de red al inscribirse.');
      }
    });
  }

  // ======== Utils visuales ========
  getImageSrc(proyecto: VmProyecto): string {
    if (proyecto.cover_url) return proyecto.cover_url;
    const first = proyecto.imagenes?.[0]?.url;
    if (first) return first;
    const mod = (proyecto.modalidad || '').toUpperCase();
    if (mod === 'PRESENCIAL') return 'assets/proyectos/presencial.svg';
    if (mod === 'VIRTUAL')    return 'assets/proyectos/virtual.svg';
    if (mod === 'MIXTA')      return 'assets/proyectos/mixta.svg';
    return 'assets/proyectos/default.svg';
  }
  getEstadoDisplay(estado: string): string {
    const key = (estado || '').toUpperCase();
    const map: Record<string, string> = {
      'PLANIFICADO': 'Planificado',
      'EN_CURSO': 'En curso',
      'CERRADO': 'Cerrado',
      'CANCELADO': 'Cancelado',
      'FINALIZADO': 'Finalizado',
    };
    return map[key] ?? estado;
  }
  getModalidadDisplay(modalidad: string): string {
    const key = (modalidad || '').toUpperCase();
    const map: Record<string, string> = {
      'PRESENCIAL': 'Presencial',
      'VIRTUAL': 'Virtual',
      'MIXTA': 'Mixta',
    };
    return map[key] ?? modalidad;
  }
  getEstadoClasses(estado: string): string {
    const key = (estado || '').toUpperCase();
    const classes: Record<string, string> = {
      'PLANIFICADO': 'bg-blue-50 text-blue-700 border-blue-200',
      'EN_CURSO': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'CERRADO': 'bg-green-50 text-green-700 border-green-200',
      'FINALIZADO': 'bg-green-50 text-green-700 border-green-200',
      'CANCELADO': 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return classes[key] || 'bg-slate-50 text-slate-700 border-slate-200';
  }
}
