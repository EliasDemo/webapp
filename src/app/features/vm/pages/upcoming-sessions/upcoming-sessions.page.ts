// src/app/features/vm/pages/upcoming-sessions/upcoming-sessions.page.ts
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
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

@Component({
  standalone: true,
  selector: 'app-upcoming-sessions-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './upcoming-sessions.page.html',
})
export class UpcomingSessionsPage implements OnDestroy {
  private api = inject(VmApiService);
  private lookups = inject(LookupsApiService);

  loading = signal(true);
  error   = signal<string | null>(null);
  now     = signal(new Date());
  cards   = signal<FlatCard[]>([]);

  periodos = signal<Array<{ id:number; anio:number; ciclo:string; estado?:string }>>([]);
  selectedPeriodoId = signal<number | null>(null);

  private timer: any;

  constructor() {
    this.bootstrap();
    this.timer = setInterval(() => this.now.set(new Date()), 30_000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  private async bootstrap() {
    this.loading.set(true);
    try {
      const per = await firstValueFrom(this.lookups.fetchPeriodos('', true));
      this.periodos.set(per);
      const cur = per.find(p => (p.estado ?? '').toUpperCase() === 'EN_CURSO') ?? per[0];
      this.selectedPeriodoId.set(cur?.id ?? null);
      await this.fetch();
    } catch {
      this.error.set('No se pudo cargar períodos.');
    } finally {
      this.loading.set(false);
    }
  }

  async fetch() {
    this.loading.set(true); this.error.set(null);
    try {
      const pid = this.selectedPeriodoId();
      const res = await firstValueFrom(this.api.listarProyectosArbol(pid ? { periodo_id: pid } : undefined));
      if (res && isApiOk(res)) {
        const page = res.data as Page<VmProyecto | { proyecto: VmProyecto; procesos: VmProcesoConSesiones[] }>;
        const arr = Array.isArray(page?.data) ? page.data : [];

        const flat: FlatCard[] = [];
        for (const it of arr as any[]) {
          const proyecto: VmProyecto = (it.proyecto ?? it) as VmProyecto;
          const procesos: VmProcesoConSesiones[] = (it.procesos ?? []) as VmProcesoConSesiones[];
          for (const pr of procesos) {
            const sesiones = pr.sesiones ?? [];
            for (const s of sesiones) {
              flat.push({ sesion: s, proyecto, proceso: pr as VmProceso });
            }
          }
        }

        flat.sort((a, b) => {
          const aIni = combine(a.sesion.fecha, a.sesion.hora_inicio).getTime();
          const bIni = combine(b.sesion.fecha, b.sesion.hora_inicio).getTime();
          return aIni - bIni;
        });

        this.cards.set(flat);
      } else {
        this.error.set((res as any)?.message || 'No se pudo cargar.');
      }
    } catch (e:any) {
      this.error.set(e?.error?.message || 'Error de red.');
    } finally {
      this.loading.set(false);
    }
  }

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
    const id = (val === null || val === undefined || val === '') ? null : Number(val);
    this.changePeriodo(id);
  }
  changePeriodo(id: number | null) {
    this.selectedPeriodoId.set(id);
    this.fetch();
  }

  trackBySesion = (_: number, c: FlatCard) => c.sesion.id;
}
