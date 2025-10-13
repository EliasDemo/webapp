import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { VmApiService } from '../../data-access/vm.api';
import {
  Id,
  isApiOk,
  InscritosResponseData,
  CandidatosResponseData,
  InscritoItem,
  CandidatoItem,
  NoElegibleItem,
} from '../../models/proyecto.models';

type ViewMode = 'INSCRITOS' | 'CANDIDATOS';

@Component({
  standalone: true,
  selector: 'app-proyecto-list-registrants',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './proyecto-list-registrants.html',
})
export class ProyectoListRegistrantsPage {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);

  // id del proyecto desde la ruta /proyectos/:proyectoId/registrantes
  proyectoId = signal<Id>(0);

  // estado UI
  view = signal<ViewMode>('INSCRITOS');
  q = signal<string>('');

  // filtros
  estado = signal<'TODOS' | 'ACTIVOS' | 'FINALIZADOS'>('TODOS');
  roles = signal<string[]>(['ALUMNO']);
  soloElegibles = signal<boolean>(true);

  // data
  loading = signal<boolean>(true);
  loadingInscritos = signal<boolean>(false);
  loadingCandidatos = signal<boolean>(false);

  inscritos = signal<InscritosResponseData | null>(null);
  candidatos = signal<CandidatosResponseData | null>(null);

  // derivados
  proyectoResumen = computed(() =>
    this.view() === 'INSCRITOS'
      ? this.inscritos()?.proyecto ?? null
      : this.candidatos()?.proyecto ?? null
  );

  // --- helpers de búsqueda ---
  private normalize(s?: string | null) {
    return (s ?? '').toLowerCase().trim();
  }
  private fullName(u?: { first_name?: string | null; last_name?: string | null; full_name?: string | null }) {
    // backend ya manda full_name; si no, lo armamos
    const explicit = this.normalize(u?.full_name);
    if (explicit) return explicit;
    const fn = this.normalize(u?.first_name);
    const ln = this.normalize(u?.last_name);
    return `${fn} ${ln}`.trim();
  }

  // filtrado de INSCRITOS (usa first_name/last_name/full_name/email/celular + código)
  inscritosFiltrados = computed(() => {
    const data = this.inscritos();
    if (!data) return [];
    const t = this.normalize(this.q());
    if (!t) return data.inscritos;

    return data.inscritos.filter((i) => {
      const codigo = this.normalize(i.expediente.codigo);
      const u = i.expediente.usuario;
      const nombre = this.fullName(u);
      const email = this.normalize(u?.email);
      const cel = this.normalize(u?.celular);
      return (
        codigo.includes(t) ||
        nombre.includes(t) ||
        email.includes(t) ||
        cel.includes(t)
      );
    });
  });

  // filtrado de CANDIDATOS (mismo criterio)
  candidatosFiltrados = computed(() => {
    const data = this.candidatos();
    const t = this.normalize(this.q());
    const filterList = <T extends { codigo?: string | null; usuario?: any }>(arr: T[]) =>
      !t
        ? arr
        : arr.filter((c) => {
            const codigo = this.normalize(c.codigo);
            const nombre = this.fullName(c.usuario);
            const email = this.normalize(c.usuario?.email);
            const cel = this.normalize(c.usuario?.celular);
            return codigo.includes(t) || nombre.includes(t) || email.includes(t) || cel.includes(t);
          });

    return {
      candidatos: data ? filterList(data.candidatos) : [],
      no_elegibles: data ? filterList(data.no_elegibles) : [],
    };
  });

  constructor() {
    // Lee el parámetro correcto de la ruta de forma reactiva
    this.route.paramMap.subscribe(async (pm) => {
      const idParam = pm.get('proyectoId') ?? pm.get('id');
      const idNum = Number(idParam);
      this.proyectoId.set(Number.isFinite(idNum) ? (idNum as Id) : (0 as Id));

      if (this.proyectoId() > 0) {
        this.loading.set(true);
        try {
          await Promise.all([this.fetchInscritos(), this.fetchCandidatos(true)]);
        } finally {
          this.loading.set(false);
        }
      }
    });
  }

  // --- API calls ---
  async fetchInscritos() {
    const pid = this.proyectoId();
    if (!pid) return;
    this.loadingInscritos.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listarInscritosProyecto(pid, {
          estado: this.estado(),
          roles: this.roles(),
        })
      );
      if (res && isApiOk(res)) this.inscritos.set(res.data);
    } finally {
      this.loadingInscritos.set(false);
    }
  }

  async fetchCandidatos(useCurrentSoloElegibles = false) {
    const pid = this.proyectoId();
    if (!pid) return;
    this.loadingCandidatos.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listarCandidatosProyecto(pid, {
          solo_elegibles: useCurrentSoloElegibles ? this.soloElegibles() : true,
        })
      );
      if (res && isApiOk(res)) this.candidatos.set(res.data);
    } finally {
      this.loadingCandidatos.set(false);
    }
  }

  // --- UI actions ---
  async changeView(v: ViewMode) {
    this.view.set(v);
    if (v === 'INSCRITOS' && !this.inscritos()) await this.fetchInscritos();
    if (v === 'CANDIDATOS' && !this.candidatos()) await this.fetchCandidatos(true);
  }

  async onApplyFilters() {
    if (this.view() === 'INSCRITOS') {
      await this.fetchInscritos();
    } else {
      await this.fetchCandidatos(true);
    }
  }

  toggleRole(r: string) {
    const set = new Set(this.roles());
    set.has(r) ? set.delete(r) : set.add(r);
    this.roles.set([...set]);
  }

  // --- helpers presentacionales ---
  mmToHHmm(n: number) {
    const total = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} h`;
  }

  percent(v: number | null) {
    return Math.min(100, v ?? 0);
  }

  pctColor(p: number | null) {
    if (p == null) return 'bg-gray-200';
    if (p >= 100) return 'bg-emerald-500';
    if (p >= 75) return 'bg-blue-500';
    if (p >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  }

  badgeEstado(e: string) {
    const s = (e ?? '').toUpperCase();
    const base = 'px-2 py-0.5 rounded-full text-xs font-semibold';
    if (s === 'FINALIZADO') return `${base} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    if (s === 'CONFIRMADO') return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
    if (s === 'INSCRITO') return `${base} bg-indigo-100 text-indigo-700 border border-indigo-200`;
    if (s === 'RETIRADO') return `${base} bg-amber-100 text-amber-700 border border-amber-200`;
    return `${base} bg-gray-100 text-gray-700 border border-gray-200`;
  }

  // trackBy (Angular no acepta arrow inline en el template)
  trackByInscrito = (_: number, i: InscritoItem) => i.participacion_id;
  trackByCandidato = (_: number, c: CandidatoItem) => c.expediente_id;
  trackByNoElegible = (_: number, n: NoElegibleItem) => n.expediente_id;
}
