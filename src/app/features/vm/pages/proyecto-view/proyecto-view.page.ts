import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import {
  VmProyectoArbol,
  VmSesion,
  VmProcesoConSesiones,
  isApiOk
} from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-view-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './proyecto-view.page.html'
})
export class ProyectoViewPage {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // state base
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<VmProyectoArbol | null>(null);

  // derived
  proyecto = computed(() => this.data()?.proyecto || null);
  procesos = computed<VmProcesoConSesiones[]>(() => this.data()?.procesos ?? []);

  isPlanificado = computed(() => (this.proyecto()?.estado || '').toUpperCase() === 'PLANIFICADO');

  portadaUrl = computed(() => {
    const p = this.proyecto();
    return p?.cover_url || p?.imagenes?.[0]?.url || null;
  });
  galeria = computed(() => this.proyecto()?.imagenes ?? []);

  // resumen de sesiones
  private sesionesFlat = computed<VmSesion[]>(() =>
    this.procesos().flatMap(p => p.sesiones ?? [])
  );
  totalSesiones = computed(() => this.sesionesFlat().length);
  totalProximas = computed(() => this.sesionesFlat().filter(s => this.relativoSesion(s) === 'PROXIMA').length);
  totalActuales = computed(() => this.sesionesFlat().filter(s => this.relativoSesion(s) === 'ACTUAL').length);
  totalPasadas  = computed(() => this.sesionesFlat().filter(s => this.relativoSesion(s) === 'PASADA').length);

  // UI helpers
  excelBusyId = signal<number | null>(null);
  private expanded = new Set<number>();
  toastMsg = signal<string | null>(null);
  toastIcon = signal<string>('fa-circle-check');

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('proyectoId'));
    if (!Number.isFinite(id)) {
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

  // --------- Presentación / lógica ---------
  estadoBadgeClassShared(est?: string): string {
    const e = String(est || '').toUpperCase();
    if (e === 'PLANIFICADO') return 'bg-amber-100 text-amber-800';
    if (e === 'EN_CURSO')    return 'bg-emerald-100 text-emerald-800';
    if (e === 'CERRADO')     return 'bg-gray-100 text-gray-800';
    if (e === 'CANCELADO')   return 'bg-rose-100 text-rose-800';
    return 'bg-slate-100 text-slate-800';
  }

  dotClass(rel: 'PROXIMA'|'ACTUAL'|'PASADA') {
    if (rel === 'PROXIMA') return 'bg-amber-400';
    if (rel === 'ACTUAL')  return 'bg-emerald-500';
    return 'bg-gray-400';
  }

  horaRange(s: VmSesion): string {
    return `${s.hora_inicio}–${s.hora_fin}`;
  }

  sesionHoras(s: VmSesion): number {
    const [h1, m1] = s.hora_inicio.split(':').map(Number);
    const [h2, m2] = s.hora_fin.split(':').map(Number);
    let start = h1 * 60 + m1;
    let end = h2 * 60 + m2;
    if (end < start) end += 24 * 60; // cruza medianoche
    const min = end - start;
    return Math.round((min / 60) * 10) / 10;
  }

  totalHorasSesionesByProceso(p: VmProcesoConSesiones): number {
    const list = p?.sesiones ?? [];
    const tot = list.reduce((acc, s) => acc + this.sesionHoras(s), 0);
    return Math.round(tot * 10) / 10;
  }

  relativoSesion(s: VmSesion): 'PROXIMA'|'ACTUAL'|'PASADA' {
    const start = new Date(`${s.fecha}T${s.hora_inicio}:00`);
    const end   = new Date(`${s.fecha}T${s.hora_fin}:00`);
    if (end <= start) end.setDate(end.getDate() + 1); // cruza medianoche
    const now = new Date();
    if (now < start) return 'PROXIMA';
    if (now >= end)  return 'PASADA';
    return 'ACTUAL';
  }

  // acordeón por sesión
  isSesionExpanded = (id: number) => this.expanded.has(id);
  toggleSesion(id: number) {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
  }

  // --------- Acciones de diseño ---------
  onEditProyectoDesignOnly() {
    this.showToast('Modo diseño: edición de proyecto');
    console.info('[Design] Editar proyecto');
  }
  onEditProcesoDesignOnly(id: number) {
    this.showToast(`Modo diseño: edición de proceso #${id}`);
    console.info('[Design] Editar proceso', id);
  }
  onEditSesionDesignOnly(pid: number, sid: number) {
    this.showToast(`Modo diseño: edición de sesión #${sid}`);
    console.info('[Design] Editar sesión', { pid, sid });
  }

  // “Generar Excel” (placeholder)
  exportarExcelSesionDesign(sesionId: number) {
    if (this.excelBusyId()) return;
    this.excelBusyId.set(sesionId);
    this.showToast('Generando Excel… (diseño)');
    // Simula proceso y feedback:
    setTimeout(() => {
      this.excelBusyId.set(null);
      this.toastIcon.set('fa-file-excel');
      this.showToast('Archivo Excel disponible próximamente');
    }, 1200);
  }

  // --------- Acciones reales existentes ---------
  async handleDelete() {
    const d = this.data(); if (!d) return;
    if (d.proyecto.estado !== 'PLANIFICADO') { alert('Solo se puede eliminar en estado PLANIFICADO'); return; }
    if (!confirm(`¿Eliminar "${d.proyecto.titulo}"?`)) return;
    await firstValueFrom(this.api.eliminarProyecto(d.proyecto.id));
    this.router.navigateByUrl('/vm/proyectos');
  }

  async handlePublish() {
    const d = this.data(); if (!d) return;
    await firstValueFrom(this.api.publicarProyecto(d.proyecto.id));
    this.fetchAll(d.proyecto.id);
  }

  // --------- Utilidades UI ---------
  trackByIndex = (_: number, __: any) => _;
  trackByProceso = (_: number, item: VmProcesoConSesiones) => item.id;
  trackBySesion = (_: number, item: VmSesion) => item.id;

  // toasts básicos
  showToast(msg: string) {
    this.toastIcon.set('fa-circle-check');
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(null), 2500);
  }
  closeToast() { this.toastMsg.set(null); }
}
