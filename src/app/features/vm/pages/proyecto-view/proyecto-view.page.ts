// ✅ FILE: src/app/vm/pages/proyecto-view/proyecto-view.page.ts

import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// API & modelos
import { VmApiService } from '../../data-access/vm.api';
import {
  VmProyectoArbol,
  VmSesion,
  VmProcesoConSesiones,
  VmProceso,
  isApiOk,
} from '../../models/proyecto.models';

// Angular templates
import { CommonModule, NgIf, NgFor, NgClass } from '@angular/common';

// Modales
import { ProyectoEditModalComponent } from '../../components/proyecto-edit-modal/proyecto-edit-modal.component';
import { ProcesoEditModalComponent } from '../../components/proceso-edit-modal/proceso-edit-modal.component';
import { SesionEditModalComponent } from '../../components/sesion-edit-modal/sesion-edit-modal.component';

@Component({
  standalone: true,
  selector: 'app-proyecto-view-page',
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    NgClass,
    RouterLink,
    ProyectoEditModalComponent,
    ProcesoEditModalComponent,
    SesionEditModalComponent,
  ],
  templateUrl: './proyecto-view.page.html',
})
export class ProyectoViewPage implements OnDestroy {
  // Inyección
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Estado base
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<VmProyectoArbol | null>(null);

  // Derivados
  proyecto = computed(() => this.data()?.proyecto || null);
  procesos = computed<VmProcesoConSesiones[]>(() => this.data()?.procesos ?? []);

  /** Sesiones ordenadas por fecha/hora dentro de cada proceso */
  procesosSorted = computed<VmProcesoConSesiones[]>(() =>
    this.procesos().map((p) => ({
      ...p,
      sesiones: [...(p.sesiones ?? [])].sort((a, b) => {
        const ta = this.parseLocalDateTime(a.fecha, a.hora_inicio)?.getTime() ?? 0;
        const tb = this.parseLocalDateTime(b.fecha, b.hora_inicio)?.getTime() ?? 0;
        return ta - tb;
      }),
    }))
  );

  isPlanificado = computed(
    () => (this.proyecto()?.estado || '').toUpperCase() === 'PLANIFICADO'
  );

  portadaUrl = computed(() => {
    const p = this.proyecto();
    return p?.cover_url || p?.imagenes?.[0]?.url || null;
  });

  galeria = computed(() => this.proyecto()?.imagenes ?? []);

  /** Niveles (para proyectos VINCULADO), soporta nivel singular legacy */
  nivelesTexto = computed(() => {
    const p = this.proyecto();
    if (!p || p.tipo !== 'VINCULADO') return null;
    const arr = p.niveles?.length ? p.niveles : (p.nivel != null ? [p.nivel] : []);
    return arr.length ? arr.join(', ') : null;
  });

  // Tick de tiempo para que los “relativos” sean reactivos
  private nowTick = signal(Date.now());
  private _timer: any = null;

  // Resumen sesiones
  private sesionesFlat = computed<VmSesion[]>(() =>
    this.procesosSorted().flatMap((p) => p.sesiones ?? [])
  );
  totalSesiones = computed(() => this.sesionesFlat().length);
  totalProximas = computed(
    () => this.sesionesFlat().filter((s) => this.relativoSesion(s) === 'PROXIMA').length
  );
  totalActuales = computed(
    () => this.sesionesFlat().filter((s) => this.relativoSesion(s) === 'ACTUAL').length
  );
  totalPasadas = computed(
    () => this.sesionesFlat().filter((s) => this.relativoSesion(s) === 'PASADA').length
  );

  // UI helpers / estado UI
  excelBusyId = signal<number | null>(null);
  ciclosBusyId = signal<number | null>(null); // carga perezosa de ciclos
  private expanded = new Set<number>();
  private fetchedCiclos = new Set<number>();
  toastMsg = signal<string | null>(null);
  toastIcon = signal<string>('fa-circle-check');

  // Modales
  proyectoEditOpen = signal(false);
  procesoEditing = signal<VmProceso | null>(null);
  sesionEditing = signal<VmSesion | null>(null);

  // Ciclo de vida
  constructor() {
    // Reaccionar a cambios en la ruta (id dinámico)
    this.route.paramMap.subscribe((pm) => {
      const raw = pm.get('proyectoId') ?? pm.get('id');
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) {
        this.error.set('ID inválido');
        this.loading.set(false);
        return;
      }
      this.fetchAll(id);
    });

    // Tick cada 30s para refrescar “Próxima/Actual/Pasada”
    this._timer = setInterval(() => this.nowTick.set(Date.now()), 30_000);
  }

  ngOnDestroy() {
    if (this._timer) clearInterval(this._timer);
  }

  async fetchAll(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.obtenerProyectoArbol(id));
      if (res && isApiOk(res)) {
        this.data.set(res.data);
      } else {
        this.error.set((res as any)?.message || 'Error');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo cargar el proyecto.');
    } finally {
      this.loading.set(false);
    }
  }

  handleRefresh() {
    const id = this.proyecto()?.id;
    if (id) this.fetchAll(id);
  }

  /** Píldora de estado del header */
  estadoPillClasses(est?: string): string {
    switch ((est || '').toUpperCase()) {
      case 'PLANIFICADO':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'EN_CURSO':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'FINALIZADO':
      case 'CERRADO':
        return 'border-slate-200 bg-slate-50 text-slate-700';
      case 'CANCELADO':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-700';
    }
  }

  /** Chip de estado para proceso/sesión */
  estadoChipClass(est?: string): string {
    const s = String(est || '').toUpperCase();
    const base = 'border px-3 py-1 rounded-full text-xs font-semibold shadow-sm';
    if (s === 'PLANIFICADO' || s === 'PROGRAMADO' || s === 'PROGRAMADA')
      return `${base} border-amber-200 bg-amber-50 text-amber-700`;
    if (s === 'EN_CURSO' || s === 'ACTIVO' || s === 'ACTIVA')
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
    if (s === 'CERRADO' || s === 'CERRADA' || s === 'FINALIZADO' || s === 'FINALIZADA')
      return `${base} border-slate-200 bg-slate-50 text-slate-700`;
    if (s === 'CANCELADO' || s === 'CANCELADA' || s === 'ANULADO' || s === 'ANULADA')
      return `${base} border-rose-200 bg-rose-50 text-rose-700`;
    return `${base} border-slate-200 bg-slate-50 text-slate-700`;
  }

  /** Punto de estado relativo (próxima/actual/pasada) */
  dotClass(rel: 'PROXIMA' | 'ACTUAL' | 'PASADA') {
    if (rel === 'PROXIMA') return 'bg-amber-400';
    if (rel === 'ACTUAL') return 'bg-emerald-500';
    return 'bg-slate-400';
  }

  // Cálculos de horario
  horaRange(s: VmSesion): string {
    if (!s?.hora_inicio || !s?.hora_fin) return '—';
    return `${s.hora_inicio}–${s.hora_fin}`;
  }

  /** Parseo local robusto (evita ambigüedad de Date ISO sin zona) */
  private parseLocalDateTime(fecha?: string | null, hhmm?: string | null): Date | null {
    if (!fecha || !hhmm) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    const [h, mi] = hhmm.split(':').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, (m - 1), d, h || 0, mi || 0, 0, 0);
  }

  sesionHoras(s: VmSesion): number {
    const [h1, m1] = (s?.hora_inicio ?? '00:00').split(':').map(Number);
    const [h2, m2] = (s?.hora_fin ?? '00:00').split(':').map(Number);
    let a = h1 * 60 + (m1 || 0);
    let b = h2 * 60 + (m2 || 0);
    if (b < a) b += 24 * 60; // cruza medianoche
    const min = Math.max(0, b - a);
    return Math.round((min / 60) * 10) / 10;
  }

  totalHorasSesionesByProceso(p: VmProcesoConSesiones): number {
    const list = p?.sesiones ?? [];
    const tot = list.reduce((acc, s) => acc + this.sesionHoras(s), 0);
    return Math.round(tot * 10) / 10;
  }

  processProgressPct(p: VmProcesoConSesiones): number {
    const plan = p.horas_asignadas ?? 0;
    if (plan <= 0) return 0;
    const have = this.totalHorasSesionesByProceso(p);
    return Math.min(100, Math.round((have / plan) * 100));
  }

  relativoSesion(s: VmSesion): 'PROXIMA' | 'ACTUAL' | 'PASADA' {
    const ini = this.parseLocalDateTime(s?.fecha, s?.hora_inicio);
    let fin = this.parseLocalDateTime(s?.fecha, s?.hora_fin);
    if (!ini || !fin) return 'PROXIMA';
    if (fin.getTime() <= ini.getTime()) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000); // cruza medianoche
    const now = new Date(this.nowTick());
    if (now < ini) return 'PROXIMA';
    if (now >= fin) return 'PASADA';
    return 'ACTUAL';
  }

  // Acordeón por sesión + lazy-load de ciclos
  isSesionExpanded = (id: number) => this.expanded.has(id);

  async toggleSesion(id: number) {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);

    if (this.expanded.has(id) && !this.fetchedCiclos.has(id)) {
      const proc = this.procesos().find(pp => pp.sesiones?.some(ss => ss.id === id));
      const ses  = proc?.sesiones?.find(x => x.id === id);
      if (ses && !ses.ciclos) {
        try {
          this.ciclosBusyId.set(id);
          const res = await firstValueFrom(this.api.obtenerSesionParaEdicion(id));
          if (res && isApiOk(res)) {
            (ses as any).ciclos = (res.data as any)?.ciclos ?? [];

            // gatillar reactividad (copiamos el array de sesiones)
            const d = this.data();
            if (d && proc) {
              this.data.set({
                ...d,
                procesos: d.procesos.map(pp =>
                  pp.id === proc.id ? ({ ...pp, sesiones: [...(pp.sesiones ?? [])] }) : pp
                ),
              });
            }
          }
        } catch {
          // Silencio intencional
        } finally {
          this.ciclosBusyId.set(null);
          this.fetchedCiclos.add(id);
        }
      }
    }
  }

  // Reglas de edición
  canEditProyecto(): boolean {
    return String(this.proyecto()?.estado || '').toUpperCase() === 'PLANIFICADO';
  }

  canEditProceso(p: { estado?: string } | VmProcesoConSesiones | VmProceso): boolean {
    const est = String(p?.estado || '').toUpperCase();
    return est !== 'EN_CURSO' && est !== 'CERRADO';
  }

  canEditSesion(s: VmSesion): boolean {
    const est = String(s?.estado || '').toUpperCase();
    return est !== 'EN_CURSO' && est !== 'CERRADO';
  }

  // Acciones
  async handleDelete() {
    const d = this.data();
    if (!d) return;
    if (String(d.proyecto.estado).toUpperCase() !== 'PLANIFICADO') {
      alert('Solo se puede eliminar en estado PLANIFICADO');
      return;
    }
    if (!confirm(`¿Eliminar "${d.proyecto.titulo}"?`)) return;
    try {
      await firstValueFrom(this.api.eliminarProyecto(d.proyecto.id));
      this.toastIcon.set('fa-circle-check');
      this.showToast('Proyecto eliminado');
      this.router.navigateByUrl('/vm/proyectos');
    } catch {
      this.toastIcon.set('fa-triangle-exclamation');
      this.showToast('No se pudo eliminar el proyecto');
    }
  }

  async handlePublish() {
    const d = this.data();
    if (!d) return;
    try {
      const res = await firstValueFrom(this.api.publicarProyecto(d.proyecto.id));
      if ((res as any)?.ok === false) throw new Error((res as any)?.message || 'Error');
      this.fetchAll(d.proyecto.id);
      this.toastIcon.set('fa-bullhorn');
      this.showToast('Proyecto publicado');
    } catch (e: any) {
      this.toastIcon.set('fa-triangle-exclamation');
      this.showToast(e?.message || 'No se pudo publicar el proyecto');
    }
  }

  // Modales: Proyecto
  openProyectoEdit() {
    if (!this.canEditProyecto()) return;
    this.proyectoEditOpen.set(true);
  }
  closeProyectoEdit() {
    this.proyectoEditOpen.set(false);
  }
  onProyectoSaved() {
    const id = this.proyecto()?.id;
    this.proyectoEditOpen.set(false);
    if (id) this.fetchAll(id);
    this.toastIcon.set('fa-circle-check');
    this.showToast('Proyecto actualizado');
  }

  // Modales: Proceso
  openProcesoEdit(procesoId: number) {
    const p = this.procesos().find((pp) => pp.id === procesoId);
    if (!p || !this.canEditProceso(p)) return;

    const base: VmProceso = {
      id: p.id,
      proyecto_id: p.proyecto_id,
      nombre: p.nombre,
      descripcion: p.descripcion ?? null,
      tipo_registro: p.tipo_registro,
      horas_asignadas: p.horas_asignadas ?? null,
      nota_minima: p.nota_minima ?? null,
      requiere_asistencia: !!p.requiere_asistencia,
      orden: p.orden ?? null,
      estado: p.estado,
      created_at: p.created_at ?? null,
    };
    this.procesoEditing.set(base);
  }
  closeProcesoEdit() {
    this.procesoEditing.set(null);
  }
  onProcesoSaved() {
    this.procesoEditing.set(null);
    const id = this.proyecto()?.id;
    if (id) this.fetchAll(id);
    this.toastIcon.set('fa-circle-check');
    this.showToast('Proceso actualizado');
  }

  // Modales: Sesión
  openSesionEdit(procesoId: number, sesionId: number) {
    const proc = this.procesos().find((pp) => pp.id === procesoId);
    const ses = proc?.sesiones?.find((x) => x.id === sesionId) || null;
    if (ses && this.canEditSesion(ses)) {
      this.sesionEditing.set(ses);
    }
  }
  closeSesionEdit() {
    this.sesionEditing.set(null);
  }
  onSesionSaved() {
    this.sesionEditing.set(null);
    const id = this.proyecto()?.id;
    if (id) this.fetchAll(id);
    this.toastIcon.set('fa-circle-check');
    this.showToast('Sesión actualizada');
  }

  // Exportar CSV de asistencias por sesión
  async exportarExcelSesion(sesionId: number) {
    if (this.excelBusyId()) return;
    this.excelBusyId.set(sesionId);
    this.showToast('Generando reporte…');
    try {
      const blob = await firstValueFrom(this.api.descargarReporteAsistenciasCSV(sesionId));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-asistencias-sesion-${sesionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.toastIcon.set('fa-download');
      this.showToast('Reporte CSV descargado');
    } catch {
      this.toastIcon.set('fa-triangle-exclamation');
      this.showToast('No se pudo descargar el reporte');
    } finally {
      this.excelBusyId.set(null);
    }
  }

  // Utilidades UI
  trackByIndex = (idx: number) => idx;
  trackByProceso = (_: number, item: VmProcesoConSesiones) => item.id;
  trackBySesion = (_: number, item: VmSesion) => item.id;

  // Niveles para una sesión desde s.niveles o s.ciclos[]
  sesionNiveles(s: VmSesion): number[] {
    if (Array.isArray(s.niveles) && s.niveles.length) {
      return [...s.niveles].sort((a,b) => a-b);
    }
    if (Array.isArray(s.ciclos) && s.ciclos.length) {
      return s.ciclos
        .map(c => Number(c?.nivel))
        .filter(n => Number.isFinite(n))
        .sort((a,b) => a-b);
    }
    return [];
  }

  showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(null), 2500);
  }
  closeToast() {
    this.toastMsg.set(null);
  }
}
