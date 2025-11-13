// ✅ FILE: src/app/vm/pages/upcoming-sessions/upcoming-sessions.page.ts
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Component, OnDestroy, OnInit, AfterViewInit,
  computed, inject, signal, ViewChild, ElementRef
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { VmApiService } from '../../data-access/vm.api';
import { LookupsApiService } from '../../lookups/lookups.api';

import {
  Page,
  VmProyecto,
  VmProceso,
  VmProcesoConSesiones,
  VmSesion,
  isApiOk,
} from '../../models/proyecto.models';

/* ========= utilidades de fecha ========= */
function normalizeFecha(fecha: string): string {
  if (!fecha) return '';
  const t = fecha.indexOf('T');
  if (t > 0) return fecha.slice(0, t);
  const sp = fecha.indexOf(' ');
  if (sp > 0) return fecha.slice(0, sp);
  return fecha;
}
function normalizeHora(h: string): string {
  if (!h) return '00:00';
  return h.length >= 5 ? h.slice(0, 5) : h;
}
function combine(fecha: string, hhmm: string): Date {
  const f = normalizeFecha(fecha);
  const h = normalizeHora(hhmm);
  return new Date(`${f}T${h}:00`);
}

/* ========= clasificación relativa ========= */
type RelState = 'SOON' | 'NOW' | 'RECENT' | 'LATER' | 'PAST';
const RECENT_WINDOW_MIN = 180; // 3 horas

type FlatCard = {
  sesion: VmSesion;
  proyecto: VmProyecto;
  proceso: VmProceso;
};

/* ========= períodos ========= */
type PeriodoOpt = { id:number; anio:number; ciclo:string; estado?:string };
type PeriodoSel = number | 'ALL' | 'CURRENT' | null;

@Component({
  standalone: true,
  selector: 'app-upcoming-sessions-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './upcoming-sessions.page.html',
})
export class UpcomingSessionsPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(VmApiService);
  private lookups = inject(LookupsApiService);

  loading = signal(true);
  error   = signal<string | null>(null);
  now     = signal(new Date());

  // Datos planos (sesiones)
  cards   = signal<FlatCard[]>([]);
  private seenSesionIds = new Set<number>(); // evita duplicados al paginar

  // Períodos
  periodos = signal<PeriodoOpt[]>([]);
  defaultPeriodoId = signal<number | null>(null);
  selectedPeriodoId = signal<PeriodoSel>('CURRENT');

  // Paginación
  page     = signal(1);
  pageSize = 24; // ajusta según performance
  hasMore  = signal(false);
  busyMore = signal(false);
  totalProj = signal<number | null>(null); // total de proyectos (si el backend lo envía)

  // Agrupación/orden de períodos
  orderedPeriodos = computed(() => {
    return [...this.periodos()].sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio; // año desc
      return Number(b.ciclo) - Number(a.ciclo);      // ciclo 2, luego 1
    });
  });
  periodoGroups = computed(() => {
    const map = new Map<number, PeriodoOpt[]>();
    for (const p of this.orderedPeriodos()) {
      const arr = map.get(p.anio) ?? [];
      arr.push(p);
      map.set(p.anio, arr);
    }
    return Array.from(map.entries())
      .map(([anio, items]) => ({ anio, items }))
      .sort((a, b) => b.anio - a.anio);
  });
  private findPeriodoById = (id?: number | null) =>
    (id ? this.periodos().find(p => p.id === id) ?? null : null);
  defaultPeriodo = computed(() => this.findPeriodoById(this.defaultPeriodoId()));

  // Resumen visible
  visibleCount = computed(() => this.cards().length);

  // Relativos (tick)
  private timer: any;

  // Infinite scroll
  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef<HTMLDivElement>;
  private io?: IntersectionObserver;

  ngOnInit() {
    this.bootstrap();
    this.timer = setInterval(() => this.now.set(new Date()), 30_000);
  }
  ngAfterViewInit() { this.setupObserver(); }
  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.io?.disconnect();
  }

  private setupObserver() {
    if (!('IntersectionObserver' in window)) return;
    this.io?.disconnect();
    this.io = new IntersectionObserver((entries) => {
      const e = entries[0];
      if (e.isIntersecting && this.hasMore() && !this.busyMore()) {
        this.loadMore(); // auto-cargar siguiente página
      }
    }, { root: null, rootMargin: '160px', threshold: 0.01 });
    if (this.sentinel?.nativeElement) {
      this.io.observe(this.sentinel.nativeElement);
    }
  }

  // Normaliza selección a id numérico (CURRENT → default; ALL → undefined)
  private normalizedPeriodoId(): number | undefined {
    const sel = this.selectedPeriodoId();
    if (sel === 'ALL' || sel === null) return undefined;
    if (sel === 'CURRENT') return this.defaultPeriodoId() ?? undefined;
    return Number(sel) || undefined;
  }
  isAllSelected(): boolean {
    return this.selectedPeriodoId() === 'ALL';
  }

  private async bootstrap() {
    this.loading.set(true);
    try {
      // 🔹 Todos los períodos
      const per = await firstValueFrom(this.lookups.fetchPeriodos('', false, 500));
      per.sort((a, b) => (b.anio - a.anio) || (Number(b.ciclo) - Number(a.ciclo)));
      this.periodos.set(per);

      const actual =
        per.find(p => (p.estado ?? '').toUpperCase() === 'EN_CURSO')
        ?? per.find(p => (p.estado ?? '').toUpperCase() === 'PLANIFICADO')
        ?? per[0];

      this.defaultPeriodoId.set(actual?.id ?? null);
      this.selectedPeriodoId.set('CURRENT');

      await this.resetAndFetch();
    } catch {
      this.error.set('No se pudo cargar períodos.');
    } finally {
      this.loading.set(false);
      setTimeout(() => this.setupObserver(), 0);
    }
  }

  // Reset total + primera página
  private async resetAndFetch() {
    this.cards.set([]);
    this.seenSesionIds.clear();
    this.page.set(1);
    this.totalProj.set(null);
    this.hasMore.set(false);
    await this.loadMore();
  }

  // Carga incremental (paginada)
  async loadMore() {
    this.busyMore.set(true);
    try {
      const pid = this.normalizedPeriodoId();
      const params: any = {};
      if (typeof pid === 'number') params.periodo_id = pid;

      // 👇 ajusta a tu backend si usa otros nombres (page/per_page)
      params.page = this.page();
      params.per_page = this.pageSize;

      const res = await firstValueFrom(this.api.listarProyectosArbol(params));
      if (!isApiOk(res)) {
        this.error.set((res as any)?.message || 'No se pudo cargar.');
        this.hasMore.set(false);
        return;
      }

      const pageRes = res.data as Page<VmProyecto | { proyecto: VmProyecto; procesos: VmProcesoConSesiones[] }>;
      const arr = Array.isArray(pageRes?.data) ? pageRes.data : [];

      // Aplana a tarjetas de sesión
      const chunk: FlatCard[] = [];
      for (const it of arr as any[]) {
        const proyecto: VmProyecto = (it.proyecto ?? it) as VmProyecto;
        const procesos: VmProcesoConSesiones[] = (it.procesos ?? []) as VmProcesoConSesiones[];
        for (const pr of procesos) {
          const sesiones = pr.sesiones ?? [];
          for (const s of sesiones) {
            if (!this.seenSesionIds.has(s.id)) {
              this.seenSesionIds.add(s.id);
              chunk.push({ sesion: s, proyecto, proceso: pr as VmProceso });
            }
          }
        }
      }

      // Ordena por inicio asc y concatena
      chunk.sort((a, b) => {
        const aIni = combine(a.sesion.fecha, a.sesion.hora_inicio).getTime();
        const bIni = combine(b.sesion.fecha, b.sesion.hora_inicio).getTime();
        return aIni - bIni;
      });
      this.cards.set([...this.cards(), ...chunk]);

      // Guarda totales si vienen del backend
      const total = (pageRes as any)?.total ?? (pageRes as any)?.meta?.total ?? null;
      if (typeof total === 'number') this.totalProj.set(total);

      // ¿hay más páginas?
      const hasNextByLinks = !!(pageRes as any)?.links?.next;
      const hasNextByMeta  = !!(pageRes as any)?.meta?.next_page;
      const chunkSize = arr.length;
      const hasNextBySize = chunkSize === this.pageSize;

      const more = hasNextByLinks || hasNextByMeta || hasNextBySize;
      this.hasMore.set(more);

      if (more) this.page.update(p => p + 1);
    } catch (e:any) {
      this.error.set(e?.error?.message || 'Error de red.');
      this.hasMore.set(false);
    } finally {
      this.busyMore.set(false);
    }
  }

  // Botón "Actualizar" → reset
  async fetch() {
    this.loading.set(true);
    await this.resetAndFetch();
    this.loading.set(false);
  }

  // Flechas de navegación entre períodos
  async stepPeriodo(dir: -1 | 1) {
    const list = this.orderedPeriodos();
    const curId = this.normalizedPeriodoId() ?? this.defaultPeriodoId() ?? null;
    if (!curId) return;
    const idx = list.findIndex(p => p.id === curId);
    if (idx < 0) return;
    const next = list[idx + dir];
    if (!next) return;
    this.selectedPeriodoId.set(next.id);
    await this.fetch();
  }

  /* ===== lógica de tarjetas ===== */
  private stateFor(s: VmSesion): RelState {
    const now = this.now();
    const ini = combine(s.fecha, s.hora_inicio);
    let fin   = combine(s.fecha, s.hora_fin);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return 'LATER';
    if (fin.getTime() < ini.getTime()) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);

    const untilStart = Math.round((ini.getTime() - now.getTime()) / 60000);
    const sinceEnd   = Math.round((now.getTime() - fin.getTime()) / 60000);

    if (now >= ini && now <= fin) return 'NOW';
    if (untilStart > 0 && untilStart <= RECENT_WINDOW_MIN) return 'SOON';
    if (sinceEnd > 0 && sinceEnd <= RECENT_WINDOW_MIN) return 'RECENT';
    if (untilStart > RECENT_WINDOW_MIN) return 'LATER';
    return 'PAST';
  }
  private endsAt(c: FlatCard) {
    const ini = combine(c.sesion.fecha, c.sesion.hora_inicio);
    let fin   = combine(c.sesion.fecha, c.sesion.hora_fin);
    if (fin.getTime() < ini.getTime()) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    return fin;
  }
  private startsAt(c: FlatCard) {
    return combine(c.sesion.fecha, c.sesion.hora_inicio);
  }

  currentNow = computed(() =>
    this.cards()
      .filter(c => this.stateFor(c.sesion) === 'NOW')
      .sort((a,b) => this.endsAt(a).getTime() - this.endsAt(b).getTime())
  );
  nextUpcoming = computed(() => {
    const future = this.cards()
      .filter(c => {
        const st = this.stateFor(c.sesion);
        return st === 'SOON' || st === 'LATER';
      })
      .sort((a,b) => this.startsAt(a).getTime() - this.startsAt(b).getTime());
    return future[0] ?? null;
  });
  heroCard = computed<FlatCard | null>(() => {
    const now = this.currentNow();
    if (now.length) return now[0];
    return this.nextUpcoming();
  });

  upcomingList = computed(() => {
    const hero = this.heroCard();
    const heroIsFuture = hero && this.stateFor(hero.sesion) !== 'NOW';
    const items = this.cards().filter(c => {
      const st = this.stateFor(c.sesion);
      if (st !== 'SOON' && st !== 'LATER') return false;
      if (heroIsFuture && hero!.sesion.id === c.sesion.id) return false;
      return true;
    });
    return items.sort((a,b) => this.startsAt(a).getTime() - this.startsAt(b).getTime());
  });

  historyList = computed(() =>
    this.cards()
      .filter(c => {
        const st = this.stateFor(c.sesion);
        return st === 'RECENT' || st === 'PAST';
      })
      .sort((a,b) => this.endsAt(b).getTime() - this.endsAt(a).getTime())
  );

  relLabel(c: FlatCard): string {
    const s = c.sesion;
    const now = this.now();
    const ini = combine(s.fecha, s.hora_inicio);
    let fin   = combine(s.fecha, s.hora_fin);
    if (fin.getTime() < ini.getTime()) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);

    const until  = Math.round((ini.getTime() - now.getTime()) / 60000);
    const since  = Math.round((now.getTime() - fin.getTime()) / 60000);
    const st = this.stateFor(s);
    if (st === 'NOW')    return 'EN CURSO';
    if (st === 'SOON')   return `En ${until} min`;
    if (st === 'RECENT') return `Terminó hace ${since} min`;
    if (st === 'LATER')  return 'Más tarde';
    return 'Pasada';
  }
  estadoChipClass(c: FlatCard): string {
    const st = this.stateFor(c.sesion);
    const base = 'px-2 py-0.5 rounded-full text-xs font-semibold border';
    if (st === 'NOW')    return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    if (st === 'SOON')   return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    if (st === 'RECENT') return `${base} bg-slate-50 text-slate-600 border-slate-200`;
    return `${base} bg-gray-50 text-gray-500 border-gray-200`;
  }
  horaRange(s: VmSesion): string {
    const i = normalizeHora(s.hora_inicio).slice(0,5);
    const f = normalizeHora(s.hora_fin).slice(0,5);
    return `${i}–${f}`;
  }

  onPeriodoChange(val: any) {
    if (val === 'ALL') {
      this.selectedPeriodoId.set('ALL');
    } else if (val === 'CURRENT') {
      this.selectedPeriodoId.set('CURRENT');
    } else {
      const id = (val === null || val === '' || val === undefined) ? null : Number(val);
      this.selectedPeriodoId.set(id);
    }
    this.fetch();
  }

  trackBySesion = (_: number, c: FlatCard) => c.sesion.id;
}
