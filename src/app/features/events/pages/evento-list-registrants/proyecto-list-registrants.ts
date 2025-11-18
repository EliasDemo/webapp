// ✅ FILE: src/app/vm/pages/evento-list-registrants/evento-list-registrants.page.ts

import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EvApiService } from '../../data-access/ev-api.service';
import {
  VmEventoInscritosData,
  VmEventoCandidatosData,
  VmEventoInscritoItem,
  VmEventoCandidatoItem,
  VmEventoNoElegibleItem,
  VmUsuarioRef,
  VmEventoResumen,
} from '../../models/ev.models';

type ViewMode = 'INSCRITOS' | 'CANDIDATOS';

@Component({
  standalone: true,
  selector: 'app-evento-list-registrants',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './evento-list-registrants.html',
})
export class EventoListRegistrantsPage {
  private api = inject(EvApiService);
  private route = inject(ActivatedRoute);

  // id del evento desde la ruta /vm/eventos/:eventoId/registrantes
  eventoId = signal<number>(0);

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

  inscritos = signal<VmEventoInscritosData | null>(null);
  candidatos = signal<VmEventoCandidatosData | null>(null);

  // info de evento (preferimos la de inscritos, si existe)
  eventoInfo = computed<VmEventoResumen | null>(() =>
    this.inscritos()?.evento ?? this.candidatos()?.evento ?? null
  );

  constructor() {
    // lee parámetro de ruta
    this.route.paramMap.subscribe(async (pm) => {
      const idParam = pm.get('eventoId') ?? pm.get('id');
      const idNum = Number(idParam);
      this.eventoId.set(Number.isFinite(idNum) ? idNum : 0);

      if (this.eventoId() > 0) {
        this.loading.set(true);
        try {
          await Promise.all([this.fetchInscritos(), this.fetchCandidatos(true)]);
        } finally {
          this.loading.set(false);
        }
      }
    });
  }

  // ────────────────── Helpers de texto ──────────────────
  private normalize(s?: string | null) {
    return (s ?? '').toLowerCase().trim();
  }

  private fullName(u?: VmUsuarioRef | null) {
    const explicit = this.normalize(u?.full_name);
    if (explicit) return explicit;
    const fn = this.normalize(u?.first_name);
    const ln = this.normalize(u?.last_name);
    return `${fn} ${ln}`.trim();
  }

  // ────────────────── Filtrado en memoria ──────────────────

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

  candidatosFiltrados = computed(() => {
    const data = this.candidatos();
    const t = this.normalize(this.q());

    const filterList = <T extends { codigo?: string | null; usuario?: VmUsuarioRef | null }>(
      arr: T[]
    ) =>
      !t
        ? arr
        : arr.filter((c) => {
            const codigo = this.normalize(c.codigo);
            const nombre = this.fullName(c.usuario);
            const email = this.normalize(c.usuario?.email);
            const cel = this.normalize(c.usuario?.celular);
            return (
              codigo.includes(t) ||
              nombre.includes(t) ||
              email.includes(t) ||
              cel.includes(t)
            );
          });

    return {
      candidatos: data ? filterList(data.candidatos) : [],
      no_elegibles: data ? filterList(data.no_elegibles) : [],
    };
  });

  // ────────────────── Llamadas API ──────────────────

  private async fetchInscritos() {
    const id = this.eventoId();
    if (!id) return;

    this.loadingInscritos.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listarInscritosEvento(id, {
          estado: this.estado(),
          roles: this.roles(),
        })
      );
      if (res && res.ok !== false && res.data) {
        this.inscritos.set(res.data);
      }
    } finally {
      this.loadingInscritos.set(false);
    }
  }

  private async fetchCandidatos(useCurrentSoloElegibles = false) {
    const id = this.eventoId();
    if (!id) return;

    this.loadingCandidatos.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listarCandidatosEvento(id, {
          solo_elegibles: useCurrentSoloElegibles ? this.soloElegibles() : true,
        })
      );
      if (res && res.ok !== false && res.data) {
        this.candidatos.set(res.data);
      }
    } finally {
      this.loadingCandidatos.set(false);
    }
  }

  // ────────────────── Acciones UI ──────────────────

  async changeView(v: ViewMode) {
    this.view.set(v);

    if (v === 'INSCRITOS' && !this.inscritos()) {
      await this.fetchInscritos();
    }
    if (v === 'CANDIDATOS' && !this.candidatos()) {
      await this.fetchCandidatos(true);
    }
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

  onDownloadExcel() {
    // Pensado a futuro: aquí iría la llamada a un endpoint tipo:
    // GET /api/vm/eventos/:evento/inscritos/export
    console.warn('Descarga de Excel aún no implementada (botón de demo).');
  }

  // ────────────────── Helpers presentacionales ──────────────────

  badgeEstado(e: string) {
    const s = (e ?? '').toUpperCase();
    const base = 'px-2 py-0.5 rounded-full text-xs font-semibold border';
    if (s === 'FINALIZADO') {
      return `${base} bg-emerald-100 text-emerald-700 border-emerald-200`;
    }
    if (s === 'CONFIRMADO') {
      return `${base} bg-blue-100 text-blue-700 border-blue-200`;
    }
    if (s === 'INSCRITO') {
      return `${base} bg-indigo-100 text-indigo-700 border-indigo-200`;
    }
    if (s === 'RETIRADO') {
      return `${base} bg-amber-100 text-amber-700 border-amber-200`;
    }
    return `${base} bg-gray-100 text-gray-700 border-gray-200`;
  }

  // trackBy
  trackByInscrito = (_: number, i: VmEventoInscritoItem) => i.participacion_id;
  trackByCandidato = (_: number, c: VmEventoCandidatoItem) => c.expediente_id;
  trackByNoElegible = (_: number, n: VmEventoNoElegibleItem) => n.expediente_id;
}
