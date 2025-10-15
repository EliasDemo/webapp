// src/app/features/vm/pages/proyecto-view/proyecto-view.page.ts
import { Component, computed, inject, signal } from '@angular/core';
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
export class ProyectoViewPage {
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

  isPlanificado = computed(
    () => (this.proyecto()?.estado || '').toUpperCase() === 'PLANIFICADO'
  );

  portadaUrl = computed(() => {
    const p = this.proyecto();
    return p?.cover_url || p?.imagenes?.[0]?.url || null;
  });

  galeria = computed(() => this.proyecto()?.imagenes ?? []);

  // Resumen sesiones
  private sesionesFlat = computed<VmSesion[]>(() =>
    this.procesos().flatMap((p) => p.sesiones ?? [])
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
  private expanded = new Set<number>();
  toastMsg = signal<string | null>(null);
  toastIcon = signal<string>('fa-circle-check');

  // Modales
  proyectoEditOpen = signal(false);
  procesoEditing = signal<VmProceso | null>(null);
  sesionEditing = signal<VmSesion | null>(null);

  // Ciclo de vida
  constructor() {
    const raw =
      this.route.snapshot.paramMap.get('proyectoId') ??
      this.route.snapshot.paramMap.get('id');
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('ID inválido');
      this.loading.set(false);
      return;
    }
    this.fetchAll(id);
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

  // Presentación / estilos coherentes con el HTML

  /** Píldora de estado del header (evita claves duplicadas en ngClass) */
  estadoPillClasses(est?: string): string {
    switch ((est || '').toUpperCase()) {
      case 'PLANIFICADO':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'EN_CURSO':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CANCELADO':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      // CERRADO u otros -> default
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

  /** Badge de estado general (por si lo necesitas más adelante) */
  estadoBadgeClassShared(est?: string): string {
    const s = String(est || '').toUpperCase();
    if (s === 'PLANIFICADO') return 'bg-amber-100 text-amber-800';
    if (s === 'EN_CURSO') return 'bg-emerald-100 text-emerald-800';
    if (s === 'CERRADO') return 'bg-gray-100 text-gray-800';
    if (s === 'CANCELADO') return 'bg-rose-100 text-rose-800';
    return 'bg-slate-100 text-slate-800';
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

  private combine(fecha?: string | null, hhmm?: string | null): Date | null {
    if (!fecha || !hhmm) return null;
    return new Date(`${fecha}T${hhmm}:00`);
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

  relativoSesion(s: VmSesion): 'PROXIMA' | 'ACTUAL' | 'PASADA' {
    const ini = this.combine(s?.fecha, s?.hora_inicio);
    let fin = this.combine(s?.fecha, s?.hora_fin);
    if (!ini || !fin) return 'PROXIMA';
    if (fin.getTime() <= ini.getTime()) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000); // cruza medianoche
    const now = new Date();
    if (now < ini) return 'PROXIMA';
    if (now >= fin) return 'PASADA';
    return 'ACTUAL';
  }

  // Acordeón por sesión
  isSesionExpanded = (id: number) => this.expanded.has(id);
  toggleSesion(id: number) {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
  }

  // Reglas de edición
  canEditProyecto(): boolean {
    return String(this.proyecto()?.estado || '').toUpperCase() === 'PLANIFICADO';
  }

  canEditProceso(p: { estado?: string } | VmProcesoConSesiones | VmProceso): boolean {
    const est = String(p?.estado || '').toUpperCase();
    // No editable si ese proceso está en curso o cerrado
    return est !== 'EN_CURSO' && est !== 'CERRADO';
  }

  canEditSesion(s: VmSesion): boolean {
    const est = String(s?.estado || '').toUpperCase();
    // No editable si ESA sesión está en curso o cerrada
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
    await firstValueFrom(this.api.eliminarProyecto(d.proyecto.id));
    this.router.navigateByUrl('/vm/proyectos');
  }

  async handlePublish() {
    const d = this.data();
    if (!d) return;
    await firstValueFrom(this.api.publicarProyecto(d.proyecto.id));
    this.fetchAll(d.proyecto.id);
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

  // Excel (placeholder)
  exportarExcelSesionDesign(sesionId: number) {
    if (this.excelBusyId()) return;
    this.excelBusyId.set(sesionId);
    this.showToast('Generando Excel…');
    setTimeout(() => {
      this.excelBusyId.set(null);
      this.toastIcon.set('fa-file-excel');
      this.showToast('Archivo Excel disponible próximamente');
    }, 1200);
  }

  // Utilidades UI
  trackByIndex = (idx: number) => idx;
  trackByProceso = (_: number, item: VmProcesoConSesiones) => item.id;
  trackBySesion = (_: number, item: VmSesion) => item.id;

  showToast(msg: string) {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(null), 2500);
  }
  closeToast() {
    this.toastMsg.set(null);
  }
}
