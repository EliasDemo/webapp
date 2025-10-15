import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

// Usa TU API y modelos del feature "mis-proyectos"
import { VmApiService } from '../../../vm/data-access/vm.api';
import { ApiResponse, isApiOk, VmProyectoArbol, VmSesion } from '../../../vm/models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-mp-view-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './mp-view.page.html',
})
export class MpViewPage {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // --- state
  loading = signal(true);
  error = signal<string | null>(null);
  data = signal<VmProyectoArbol | null>(null);
  private lastProyectoId = signal<number | null>(null);

  // --- computed
  proyecto = computed(() => this.data()?.proyecto ?? null);
  procesos  = computed(() => this.data()?.procesos ?? []);
  portadaUrl = computed(() => {
    const p = this.proyecto();
    return p?.cover_url || p?.imagenes?.[0]?.url || null;
  });
  galeria = computed(() => this.proyecto()?.imagenes ?? []);

  constructor() {
    // Soporta :proyectoId y :id
    this.route.paramMap.subscribe(async pm => {
      const raw = pm.get('proyectoId') ?? pm.get('id');
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) {
        this.error.set('ID inválido');
        this.loading.set(false);
        return;
      }
      this.lastProyectoId.set(id);
      await this.fetchAll(id);
    });
  }

  private async fetchAll(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom<ApiResponse<VmProyectoArbol>>(
        this.api.obtenerProyectoArbolAlumno(id)  // 👈 ahora llama al endpoint de alumno
      );
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

  // ---------- Helpers de UI ----------
  headerEstadoBadge(): string {
    const s = String(this.proyecto()?.estado ?? '').toUpperCase();
    if (s === 'PLANIFICADO') return 'bg-amber-100 text-amber-800 shadow-md';
    if (s === 'EN_CURSO')    return 'bg-emerald-100 text-emerald-800 shadow-md';
    if (s === 'CERRADO')     return 'bg-gray-100 text-gray-800 shadow-md';
    return 'bg-slate-100 text-slate-800 shadow-md';
  }

  estadoChipClass(e: string | null | undefined): string {
    const s = String(e ?? '').toUpperCase();
    const base = 'px-3 py-1 rounded-full text-xs font-semibold border shadow-sm';
    if (['PLANIFICADO','PROGRAMADO','PROGRAMADA'].includes(s)) return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    if (['EN_CURSO','ACTIVO','ACTIVA'].includes(s))             return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    if (['FINALIZADO','FINALIZADA','CERRADO','CERRADA'].includes(s)) return `${base} bg-slate-100 text-slate-700 border-slate-200`;
    if (['CANCELADO','CANCELADA','ANULADO','ANULADA'].includes(s))   return `${base} bg-rose-50 text-rose-700 border-rose-200`;
    return `${base} bg-gray-100 text-gray-700 border-gray-200`;
  }

  horaRange(s: VmSesion): string {
    return `${s.hora_inicio}–${s.hora_fin}`;
  }

  sesionHoras(s: VmSesion): number {
    const [h1, m1] = (s.hora_inicio ?? '00:00').split(':').map(Number);
    const [h2, m2] = (s.hora_fin ?? '00:00').split(':').map(Number);
    let a = h1 * 60 + (m1 || 0);
    let b = h2 * 60 + (m2 || 0);
    if (b < a) b += 24 * 60; // cruza medianoche
    const min = Math.max(0, b - a);
    return Math.round((min / 60) * 10) / 10;
  }

  totalHorasSesiones(procIdx: number): number {
    const p = this.procesos()[procIdx];
    const tot = (p?.sesiones ?? []).reduce((acc: number, s: VmSesion) => acc + this.sesionHoras(s), 0);
    return Math.round(tot * 10) / 10;
  }

  private combine(fecha: string, hhmm: string): Date { return new Date(`${fecha}T${hhmm}`); }

  sesionRelativa(s: VmSesion): 'PROXIMA' | 'ACTUAL' | 'PASADA' {
    if (!s.fecha || !s.hora_inicio || !s.hora_fin) return 'PROXIMA';
    const now = new Date();
    const ini = this.combine(s.fecha, s.hora_inicio);
    let fin   = this.combine(s.fecha, s.hora_fin);
    if (fin.getTime() < ini.getTime()) fin = new Date(fin.getTime() + 24*60*60*1000);
    if (now < ini) return 'PROXIMA';
    if (now > fin) return 'PASADA';
    return 'ACTUAL';
  }

  // Alias para coincidir con el template (usa relativoSesion(s))
  relativoSesion(s: VmSesion) { return this.sesionRelativa(s); }

  sesionRelChipClass(s: VmSesion): string {
    const r = this.sesionRelativa(s);
    const base = 'px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm';
    if (r === 'ACTUAL')   return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    if (r === 'PROXIMA')  return `${base} bg-indigo-50 text-indigo-700 border-indigo-200`;
    return `${base} bg-slate-100 text-slate-600 border-slate-200`;
  }

  // Puntos de estado (lucecita)
  dotClass(rel: 'PROXIMA' | 'ACTUAL' | 'PASADA' | string): string {
    const s = String(rel).toUpperCase();
    if (s === 'ACTUAL')  return 'bg-blue-500';
    if (s === 'PROXIMA') return 'bg-amber-500';
    if (s === 'PASADA')  return 'bg-slate-400';
    return 'bg-gray-300';
  }

  // Dashboard mini (total sesiones / próximas)
  totalSesiones(): number {
    return this.procesos().reduce((acc: number, p: any) => acc + (p?.sesiones?.length ?? 0), 0);
  }

  totalProximas(): number {
    return this.procesos().reduce((acc: number, p: any) => {
      const add = (p?.sesiones ?? []).filter((s: VmSesion) => this.sesionRelativa(s) === 'PROXIMA').length;
      return acc + add;
    }, 0);
  }

  // Navegación / acciones
  verGaleriaCompleta(): void {
    const id = this.lastProyectoId();
    // Ajusta esta ruta a la que tengas definida para la galería
    if (id) {
      this.router.navigate(['/mis-proyectos', id, 'galeria']);
    } else {
      // fallback: si no hay ruta, al menos no rompas la UI
      console.warn('Ruta de galería no configurada.');
    }
  }

  recargarProcesos(): void {
    const id = this.lastProyectoId();
    if (id) this.fetchAll(id);
  }

  recargarPagina(): void {
    // Si prefieres no recargar completamente, reutiliza recargarProcesos()
    if (typeof window !== 'undefined') window.location.reload();
  }

  trackBySesion = (_: number, s: VmSesion) => s.id;

  goBack() { this.router.navigateByUrl('/mp'); }
  puedeRegistrar(s: VmSesion): boolean { return this.sesionRelativa(s) === 'ACTUAL'; }
}
