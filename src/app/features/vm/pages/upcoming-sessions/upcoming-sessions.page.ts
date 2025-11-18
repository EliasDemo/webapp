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

// ⚠️ AJUSTA la ruta según dónde tengas EvApiService
import { EvApiService } from '../../../events/data-access/ev-api.service';

import {
  Page,
  VmProyecto,
  VmProceso,
  VmProcesoConSesiones,
  VmSesion as VmSesionProyecto,
  isApiOk,
} from '../../models/proyecto.models';

// ⚠️ AJUSTA la ruta según tu estructura
import {
  VmEvento,
  VmSesion as VmSesionEvento,
} from '../../../events/models/ev.models';

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

/** Cualquier sesión que tenga fecha + hora */
interface SesionLike {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

/* ========= tarjetas mezcladas ========= */
interface FlatCard {
  kind: 'PROYECTO' | 'EVENTO';
  sesion: VmSesionProyecto | VmSesionEvento;
  // Para proyectos
  proyecto?: VmProyecto;
  proceso?: VmProceso;
  // Para eventos
  evento?: VmEvento;
  // Info de orden
  sesionIndex: number;
  sesionTotal: number;
}

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
  private evApi = inject(EvApiService);

  loading = signal(true);
  error   = signal<string | null>(null);
  now     = signal(new Date());

  // Datos planos (sesiones mezcladas)
  cards   = signal<FlatCard[]>([]);
  // Evita duplicar sesiones (clave = tipo + id)
  private seenSesionKeys = new Set<string>();

  // Períodos
  periodos = signal<PeriodoOpt[]>([]);
  defaultPeriodoId = signal<number | null>(null);
  selectedPeriodoId = signal<PeriodoSel>('CURRENT');

  // Paginación compartida
  page     = signal(1);
  pageSize = 24;
  hasMore  = signal(false);
  busyMore = signal(false);
  totalProj = signal<number | null>(null); // solo proyectos (para el texto de resumen)

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
        this.loadMore();
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
    this.seenSesionKeys.clear();
    this.page.set(1);
    this.totalProj.set(null);
    this.hasMore.set(false);
    await this.loadMore();
  }

  // Carga incremental (paginada) → proyectos + eventos
  async loadMore() {
    this.busyMore.set(true);
    try {
      const pid = this.normalizedPeriodoId();
      const pageNum = this.page();

      // ----------- Proyectos -----------
      const projParams: any = { page: pageNum, per_page: this.pageSize };
      if (typeof pid === 'number') projParams.periodo_id = pid;

      const projPromise = firstValueFrom(this.api.listarProyectosArbol(projParams));
      const evPromise   = firstValueFrom(this.evApi.listarEventos({ page: pageNum }));

      const [resProj, resEv] = await Promise.all([projPromise, evPromise]);

      const chunk: FlatCard[] = [];

      // 🔹 Sesiones de PROYECTOS
      let moreProjects = false;
      if (isApiOk(resProj)) {
        const pageRes = resProj.data as Page<
          VmProyecto | { proyecto: VmProyecto; procesos: VmProcesoConSesiones[] }
        >;
        const arr = Array.isArray(pageRes?.data) ? pageRes.data : [];

        const projChunk: FlatCard[] = [];
        for (const it of arr as any[]) {
          const proyecto: VmProyecto = (it.proyecto ?? it) as VmProyecto;
          const procesos: VmProcesoConSesiones[] =
            (it.procesos ?? []) as VmProcesoConSesiones[];

          for (const pr of procesos) {
            const sesiones = pr.sesiones ?? [];
            if (!sesiones.length) continue;

            const sortedSesiones = [...sesiones].sort((a, b) => {
              const aIni = combine(a.fecha, a.hora_inicio).getTime();
              const bIni = combine(b.fecha, b.hora_inicio).getTime();
              return aIni - bIni;
            });

            const total = sortedSesiones.length;

            sortedSesiones.forEach((s, idx) => {
              const key = `P-${s.id}`;
              if (this.seenSesionKeys.has(key)) return;
              this.seenSesionKeys.add(key);

              projChunk.push({
                kind: 'PROYECTO',
                sesion: s,
                proyecto,
                proceso: pr as VmProceso,
                evento: undefined,
                sesionIndex: idx + 1,
                sesionTotal: total,
              });
            });
          }
        }

        // Guarda totales de proyectos si vienen del backend
        const total = (pageRes as any)?.total ?? (pageRes as any)?.meta?.total ?? null;
        if (typeof total === 'number') this.totalProj.set(total);

        chunk.push(...projChunk);

        // ¿hay más páginas de proyectos?
        const hasNextByLinks = !!(pageRes as any)?.links?.next;
        const hasNextByMeta  = !!(pageRes as any)?.meta?.next_page;
        const chunkSize = (pageRes as any)?.data?.length ?? 0;
        moreProjects = hasNextByLinks || hasNextByMeta || chunkSize === this.pageSize;
      } else {
        this.error.set((resProj as any)?.message || 'No se pudieron cargar proyectos.');
        moreProjects = false;
      }

      // 🔹 Sesiones de EVENTOS
      let moreEvents = false;
      if (resEv.ok) {
        const items = resEv.data.items ?? [];
        const evChunk: FlatCard[] = [];

        for (const ev of items as VmEvento[]) {
          // Si hay periodo seleccionado, filtramos aquí
          if (typeof pid === 'number' && ev.periodo_id !== pid) continue;

          const sesiones = ev.sesiones ?? [];
          if (!sesiones.length) continue;

          const sortedSesiones = [...sesiones].sort((a, b) => {
            const aIni = combine(a.fecha, a.hora_inicio).getTime();
            const bIni = combine(b.fecha, b.hora_inicio).getTime();
            return aIni - bIni;
          });

          const total = sortedSesiones.length;

          sortedSesiones.forEach((s, idx) => {
            const key = `E-${s.id}`;
            if (this.seenSesionKeys.has(key)) return;
            this.seenSesionKeys.add(key);

            evChunk.push({
              kind: 'EVENTO',
              sesion: s,
              proyecto: undefined,
              proceso: undefined,
              evento: ev,
              sesionIndex: idx + 1,
              sesionTotal: total,
            });
          });
        }

        chunk.push(...evChunk);

        // Cálculo simple de si hay más eventos
        moreEvents = (items.length === this.pageSize);
      }

      // Ordena TODO por fecha/hora y concatena
      chunk.sort((a, b) => {
        const aIni = combine(
          (a.sesion as SesionLike).fecha,
          (a.sesion as SesionLike).hora_inicio
        ).getTime();
        const bIni = combine(
          (b.sesion as SesionLike).fecha,
          (b.sesion as SesionLike).hora_inicio
        ).getTime();
        return aIni - bIni;
      });
      this.cards.set([...this.cards(), ...chunk]);

      const more = !!moreProjects || !!moreEvents;
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
  private stateFor(s: SesionLike): RelState {
    const now = this.now();
    const ini = combine(s.fecha, s.hora_inicio);
    let fin   = combine(s.fecha, s.hora_fin);
    if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return 'LATER';
    if (fin.getTime() < ini.getTime()) {
      // cruza medianoche
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }

    const untilStart = Math.round((ini.getTime() - now.getTime()) / 60000);
    const sinceEnd   = Math.round((now.getTime() - fin.getTime()) / 60000);

    if (now >= ini && now <= fin) return 'NOW';
    if (untilStart > 0 && untilStart <= RECENT_WINDOW_MIN) return 'SOON';
    if (sinceEnd > 0 && sinceEnd <= RECENT_WINDOW_MIN) return 'RECENT';
    if (untilStart > RECENT_WINDOW_MIN) return 'LATER';
    return 'PAST';
  }

  private endsAt(c: FlatCard) {
    const s = c.sesion as SesionLike;
    const ini = combine(s.fecha, s.hora_inicio);
    let fin   = combine(s.fecha, s.hora_fin);
    if (fin.getTime() < ini.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }
    return fin;
  }

  private startsAt(c: FlatCard) {
    const s = c.sesion as SesionLike;
    return combine(s.fecha, s.hora_inicio);
  }

  currentNow = computed(() =>
    this.cards()
      .filter(c => this.stateFor(c.sesion as SesionLike) === 'NOW')
      .sort((a,b) => this.endsAt(a).getTime() - this.endsAt(b).getTime())
  );

  nextUpcoming = computed(() => {
    const future = this.cards()
      .filter(c => {
        const st = this.stateFor(c.sesion as SesionLike);
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
    const heroIsFuture = !!(hero && this.stateFor(hero.sesion as SesionLike) !== 'NOW');
    const items = this.cards().filter(c => {
      const st = this.stateFor(c.sesion as SesionLike);
      if (st !== 'SOON' && st !== 'LATER') return false;
      if (heroIsFuture && hero!.sesion.id === c.sesion.id) return false;
      return true;
    });
    return items.sort((a,b) => this.startsAt(a).getTime() - this.startsAt(b).getTime());
  });

  historyList = computed(() =>
    this.cards()
      .filter(c => {
        const st = this.stateFor(c.sesion as SesionLike);
        return st === 'RECENT' || st === 'PAST';
      })
      .sort((a,b) => this.endsAt(b).getTime() - this.endsAt(a).getTime())
  );

  relLabel(c: FlatCard): string {
    const s = c.sesion as SesionLike;
    const now = this.now();
    const ini = combine(s.fecha, s.hora_inicio);
    let fin   = combine(s.fecha, s.hora_fin);
    if (fin.getTime() < ini.getTime()) {
      fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    }

    const until  = Math.round((ini.getTime() - now.getTime()) / 60000);
    const since  = Math.round((now.getTime() - fin.getTime()) / 60000);
    const st = this.stateFor(s);

    if (st === 'NOW')    return 'EN CURSO';
    if (st === 'SOON')   return `En ${until} min`;
    if (st === 'RECENT') return `Terminó hace ${since} min`;

    // Para LATER / PAST → usamos días
    const sessionDate = new Date(normalizeFecha(s.fecha));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round(
      (sessionDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (st === 'LATER') {
      if (diffDays === 0) return 'Más tarde hoy';
      if (diffDays === 1) return 'Mañana';
      if (diffDays > 1)   return `Faltan ${diffDays} días`;
      return 'Más tarde';
    }

    // st === 'PAST'
    const pastDays = -diffDays;
    if (pastDays === 0) return 'Más temprano hoy';
    if (pastDays === 1) return 'Ayer';
    if (pastDays > 1)   return `Hace ${pastDays} días`;
    return 'Pasada';
  }

  estadoChipClass(c: FlatCard): string {
    const st = this.stateFor(c.sesion as SesionLike);
    const base = 'px-2 py-0.5 rounded-full text-xs font-semibold border';
    if (st === 'NOW')    return `${base} bg-blue-50 text-blue-700 border-blue-200`;
    if (st === 'SOON')   return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    if (st === 'RECENT') return `${base} bg-slate-50 text-slate-600 border-slate-200`;
    return `${base} bg-gray-50 text-gray-500 border-gray-200`;
  }

  horaRange(s: SesionLike): string {
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

  // Helpers para el template
  isProyecto(card: FlatCard): boolean {
    return card.kind === 'PROYECTO';
  }

  cardTitle(card: FlatCard): string {
    if (card.kind === 'PROYECTO') {
      return card.proyecto?.titulo ?? 'Proyecto sin título';
    }
    return card.evento?.titulo ?? 'Evento sin título';
  }

  cardContextName(card: FlatCard): string {
    if (card.kind === 'PROYECTO') {
      return card.proceso?.nombre ?? 'Proyecto';
    }
    return card.evento?.categoria?.nombre ?? 'Evento';
  }

  cardRouterLink(card: FlatCard): any[] {
    if (card.kind === 'PROYECTO') {
      return ['/vm', 'proyectos', card.proyecto?.id ?? 0];
    }
    // Evento
    return ['/vm', 'eventos', card.evento?.id ?? 0];
  }

  cardTypeLetter(card: FlatCard): string {
    return card.kind === 'PROYECTO' ? 'P' : 'V';
  }

  cardTypeClass(card: FlatCard): string {
    // Proyecto → azul, Evento → verde
    return card.kind === 'PROYECTO'
      ? 'bg-blue-600 text-white'
      : 'bg-emerald-500 text-white';
  }

  // Usamos clave tipo "PROYECTO-123" / "EVENTO-10"
  trackBySesion = (_: number, c: FlatCard) => `${c.kind}-${c.sesion.id}`;
}
