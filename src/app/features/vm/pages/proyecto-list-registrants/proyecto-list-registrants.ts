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
  BulkEnrollStats,
  BulkEnrolResponseData,
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

  // inscripción masiva
  massEnrolling = signal<boolean>(false);
  massEnrollMsg = signal<string | null>(null);

  // selección de candidatos (por expediente_id)
  selectedExpedientes = signal<Id[]>([]);

  // derivados
  proyectoResumen = computed(() =>
    this.view() === 'INSCRITOS'
      ? this.inscritos()?.proyecto ?? null
      : this.candidatos()?.proyecto ?? null
  );

  selectedCount = computed(() => this.selectedExpedientes().length);

  // --- helpers de búsqueda ---
  private normalize(s?: string | null) {
    return (s ?? '').toLowerCase().trim();
  }

  private fullName(u?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
  }) {
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

    const filterList = <T extends { codigo?: string | null; usuario?: any }>(
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
    this.massEnrollMsg.set(null); // limpiar mensaje al cambiar de pestaña
    this.clearSelection();        // por si cambias a INSCRITOS, limpiamos selección

    if (v === 'INSCRITOS' && !this.inscritos()) await this.fetchInscritos();
    if (v === 'CANDIDATOS' && !this.candidatos()) await this.fetchCandidatos(true);
  }

  async onApplyFilters() {
    this.massEnrollMsg.set(null);
    if (this.view() === 'INSCRITOS') {
      await this.fetchInscritos();
    } else {
      this.clearSelection();
      await this.fetchCandidatos(true);
    }
  }

  // 🔹 NUEVO: reset de filtros (lo llama el botón "Restablecer filtros")
  async onResetFilters() {
    this.q.set('');
    this.estado.set('TODOS');
    this.roles.set(['ALUMNO']);
    this.soloElegibles.set(true);
    this.massEnrollMsg.set(null);
    this.clearSelection();

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

  // --- selección de candidatos ---
  isSelected(c: CandidatoItem): boolean {
    return this.selectedExpedientes().includes(c.expediente_id as Id);
  }

  toggleCandidate(c: CandidatoItem, checked: boolean) {
    const current = new Set(this.selectedExpedientes());
    if (checked) current.add(c.expediente_id as Id);
    else current.delete(c.expediente_id as Id);
    this.selectedExpedientes.set([...current]);
  }

  selectAllFiltered() {
    const ids = this.candidatosFiltrados().candidatos.map(
      (c) => c.expediente_id as Id
    );
    this.selectedExpedientes.set([...new Set(ids)]);
  }

  clearSelection() {
    this.selectedExpedientes.set([]);
  }

  // 🔹 NUEVO: checkbox "seleccionar todos" de la cabecera de la tabla
  isAllFilteredSelected(): boolean {
    const filtered = this.candidatosFiltrados().candidatos;
    if (!filtered.length) return false;

    const selected = new Set(this.selectedExpedientes());
    return filtered.every((c) => selected.has(c.expediente_id as Id));
  }

  toggleAllFiltered(checked: boolean) {
    if (checked) {
      // marcar todos los candidatos filtrados
      this.selectAllFiltered();
    } else {
      // desmarcar solo los que están visibles en este momento
      const filteredIds = new Set(
        this.candidatosFiltrados().candidatos.map(
          (c) => c.expediente_id as Id
        )
      );
      const current = new Set(this.selectedExpedientes());
      filteredIds.forEach((id) => current.delete(id));
      this.selectedExpedientes.set([...current]);
    }
  }

  /** Inscribir masivamente a TODOS los candidatos elegibles (según filtros actuales) */
  async onMassEnrollElegibles() {
    const pid = this.proyectoId();
    if (!pid) return;

    const elegibles = this.candidatosFiltrados().candidatos;
    if (!elegibles.length) {
      this.massEnrollMsg.set('No hay candidatos elegibles con los filtros actuales.');
      return;
    }

    this.massEnrollMsg.set(null);
    this.massEnrolling.set(true);

    try {
      const res = await firstValueFrom(
        this.api.inscribirTodosCandidatosProyecto(pid, {
          solo_elegibles: this.soloElegibles(),
          q: this.q() || undefined,
        })
      );

      if (res && isApiOk<BulkEnrollStats>(res)) {
        const d = res.data;
        this.massEnrollMsg.set(
          `Inscritos (todos elegibles): ${d.creados} · Ya inscritos: ${d.ya_inscritos}` +
            (d.descartados_total ? ` · No elegibles: ${d.descartados_total}` : '')
        );

        // refrescamos listas (inscritos + candidatos)
        await Promise.all([this.fetchInscritos(), this.fetchCandidatos(true)]);
        this.clearSelection();
      } else if (res && !isApiOk(res)) {
        this.massEnrollMsg.set(
          res.message || 'No se pudo completar la inscripción masiva.'
        );
      }
    } catch (e: any) {
      this.massEnrollMsg.set(
        'Error de red o servidor al inscribir candidatos (todos elegibles).'
      );
    } finally {
      this.massEnrolling.set(false);
    }
  }

  /** Inscribir SOLO expedientes seleccionados */
  async onMassEnrollSeleccionados() {
    const pid = this.proyectoId();
    if (!pid) return;

    const ids = this.selectedExpedientes();
    if (!ids.length) {
      this.massEnrollMsg.set('Selecciona al menos un candidato.');
      return;
    }

    this.massEnrollMsg.set(null);
    this.massEnrolling.set(true);

    try {
      const res = await firstValueFrom(
        this.api.inscribirCandidatosSeleccionadosProyecto(pid, ids)
      );

      if (res && isApiOk<BulkEnrolResponseData>(res)) {
        const d = res.data;
        this.massEnrollMsg.set(
          `Inscritos (seleccionados): ${d.creados} · Ya inscritos: ${d.ya_inscritos}` +
            (d.descartados_total ? ` · No elegibles: ${d.descartados_total}` : '')
        );

        await Promise.all([this.fetchInscritos(), this.fetchCandidatos(true)]);
        this.clearSelection();
      } else if (res && !isApiOk(res)) {
        this.massEnrollMsg.set(
          res.message || 'No se pudo completar la inscripción de seleccionados.'
        );
      }
    } catch (e: any) {
      this.massEnrollMsg.set(
        'Error de red o servidor al inscribir candidatos seleccionados.'
      );
    } finally {
      this.massEnrolling.set(false);
    }
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
    if (s === 'FINALIZADO')
      return `${base} bg-emerald-100 text-emerald-700 border border-emerald-200`;
    if (s === 'CONFIRMADO')
      return `${base} bg-blue-100 text-blue-700 border border-blue-200`;
    if (s === 'INSCRITO')
      return `${base} bg-indigo-100 text-indigo-700 border border-indigo-200`;
    if (s === 'RETIRADO')
      return `${base} bg-amber-100 text-amber-700 border border-amber-200`;
    return `${base} bg-gray-100 text-gray-700 border border-gray-200`;
  }

  // trackBy
  trackByInscrito = (_: number, i: InscritoItem) => i.participacion_id;
  trackByCandidato = (_: number, c: CandidatoItem) => c.expediente_id;
  trackByNoElegible = (_: number, n: NoElegibleItem) => n.expediente_id;
}
