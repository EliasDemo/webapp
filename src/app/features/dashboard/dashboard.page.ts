// src/app/features/dashboard/dashboard.page.ts
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { UserStore } from '../../core/state/user.store';

import { VmApiService } from '../vm/data-access/vm.api';
import { EvApiService } from '../events/data-access/ev-api.service';
import { HorasApiService } from '../hours/data-access/h.api';

import type {
  ApiResponse as VmApiResponse,
  VmProyecto,
  ProyectosAlumnoData,
  AlumnoAgendaResponse,
  AlumnoProyectoAgenda,
  AlumnoProcesoResumen,
  AlumnoSesion,
  AlumnoSesionEstado,
  VmSesion,
} from '../vm/models/proyecto.models';

import type {
  VmMisEventosData,
  VmEventoAlumnoItem,
  VmEvento,
  VmEstado,
  Periodo,
  VmEventoParticipacionRef,
} from '../events/models/ev.models';

import type {
  ReporteHorasResponse,
  ReporteHorasData,
  ResumenPorPeriodoItem,
} from '../hours/models/h.models';

interface ProximaSesionVM {
  sesion: VmSesion;
  proyecto: VmProyecto;
  procesoNombre: string;
  estado_relativo: AlumnoSesionEstado;
}

// VM específico para el dashboard
interface EventoDashboardVM {
  id: number;
  codigo: string;
  titulo: string;
  subtitulo?: string | null;
  descripcion_corta?: string | null;

  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA';
  estado: VmEstado;

  periodo_id?: number;
  periodo?: Periodo | null;

  requiere_inscripcion: boolean;
  cupo_maximo?: number | null;

  inscripcion_desde?: string | null;
  inscripcion_hasta?: string | null;

  participacion?: VmEventoParticipacionRef | null;
}

@Component({
  standalone: true,
  selector: 'app-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.page.html',
  styleUrls: [],
})
export class DashboardPage {
  private t = inject(TranslocoService);
  private store = inject(UserStore);

  private vmApi = inject(VmApiService);
  private evApi = inject(EvApiService);
  private horasApi = inject(HorasApiService);

  // Idioma
  lang = this.t.getActiveLang();

  // Estado general
  initialLoading = signal(true);
  globalError = signal<string | null>(null);

  // Loading por bloque
  loadingProyectos = signal(false);
  loadingEventos = signal(false);
  loadingSesiones = signal(false);
  loadingHoras = signal(false);

  // Datos alumno
  proyectosAlumno = signal<ProyectosAlumnoData | null>(null);
  agendaAlumno = signal<AlumnoAgendaResponse | null>(null);

  // Eventos: catálogo general + mis participaciones
  eventosCatalogo = signal<VmEvento[]>([]);
  misEventos = signal<VmMisEventosData | null>(null);

  // Horas
  miReporteHoras = signal<ReporteHorasData | null>(null);

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  constructor() {
    this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      const tasks: Promise<void>[] = [];

      // El dashboard está centrado en el rol ESTUDIANTE
      if (this.isEstudiante()) {
        tasks.push(this.loadProyectosAlumno());
        tasks.push(this.loadAgendaAlumno());
        tasks.push(this.loadMisEventosAlumno());
        tasks.push(this.loadMisHoras());
      }

      await Promise.all(tasks);
    } catch (e) {
      console.error('[Dashboard] Error al cargar', e);
      this.globalError.set(
        'Ocurrió un problema al cargar tu panel. Algunas tarjetas pueden no mostrarse.'
      );
    } finally {
      this.initialLoading.set(false);
    }
  }

  // ─────────────────────────────────────────────
  // Roles / permisos
  // ─────────────────────────────────────────────

  isEstudiante(): boolean {
    return this.store.hasAnyRole(['ESTUDIANTE']);
  }

  isStaffOrAdmin(): boolean {
    return this.store.hasAnyRole(['COORDINADOR', 'ENCARGADO', 'ADMINISTRADOR']);
  }

  // ─────────────────────────────────────────────
  // Cargas de datos (alumno)
  // ─────────────────────────────────────────────

  private async loadProyectosAlumno(): Promise<void> {
    this.loadingProyectos.set(true);
    try {
      const resp = await firstValueFrom<VmApiResponse<ProyectosAlumnoData>>(
        this.vmApi.listarProyectosAlumno()
      );
      if (resp.ok) {
        this.proyectosAlumno.set(resp.data);
      }
    } catch (e) {
      console.error('[Dashboard] loadProyectosAlumno', e);
    } finally {
      this.loadingProyectos.set(false);
    }
  }

  private async loadAgendaAlumno(): Promise<void> {
    this.loadingSesiones.set(true);
    try {
      const resp = await firstValueFrom<VmApiResponse<AlumnoAgendaResponse>>(
        this.vmApi.obtenerAgendaAlumno()
      );
      if (resp.ok) {
        this.agendaAlumno.set(resp.data);
      }
    } catch (e) {
      console.error('[Dashboard] loadAgendaAlumno', e);
    } finally {
      this.loadingSesiones.set(false);
    }
  }

  /**
   * Eventos para el dashboard:
   * - listarEventos({ solo_mi_ep_sede: 1 }) → catálogo (PLANIFICADO, EN_CURSO, etc.)
   * - listarMisEventos({ estado_participacion: 'TODOS' }) → saber dónde estoy inscrito.
   */
  private async loadMisEventosAlumno(): Promise<void> {
    this.loadingEventos.set(true);
    try {
      const catalogoPromise = firstValueFrom(
        this.evApi.listarEventos({
          solo_mi_ep_sede: 1,
          page: 1,
        })
      );

      const misEventosPromise = firstValueFrom(
        this.evApi.listarMisEventos({
          estado_participacion: 'TODOS',
        })
      );

      const [catalogoResp, misResp] = await Promise.all([
        catalogoPromise,
        misEventosPromise,
      ]);

      if (catalogoResp.ok && catalogoResp.data?.items) {
        this.eventosCatalogo.set(catalogoResp.data.items);
      } else {
        this.eventosCatalogo.set([]);
      }

      if (misResp.ok) {
        this.misEventos.set(misResp.data);
      } else {
        this.misEventos.set({ periodos: [], eventos: [] });
      }
    } catch (e) {
      console.error('[Dashboard] loadMisEventosAlumno', e);
      this.eventosCatalogo.set([]);
      this.misEventos.set({ periodos: [], eventos: [] });
    } finally {
      this.loadingEventos.set(false);
    }
  }

  private async loadMisHoras(): Promise<void> {
    this.loadingHoras.set(true);
    try {
      const resp = await firstValueFrom<ReporteHorasResponse>(
        this.horasApi.obtenerMiReporteHoras()
      );
      if (resp.ok) {
        this.miReporteHoras.set(resp.data);
      } else {
        console.warn('[Dashboard] obtenerMiReporteHoras no ok', resp);
      }
    } catch (e) {
      console.error('[Dashboard] loadMisHoras', e);
    } finally {
      this.loadingHoras.set(false);
    }
  }

  // ─────────────────────────────────────────────
  // Datos derivados: PROYECTOS
  // ─────────────────────────────────────────────

  pendientesAlumno = computed(
    () => this.proyectosAlumno()?.pendientes ?? []
  );

  inscribiblesAlumno = computed(
    () => this.proyectosAlumno()?.inscribibles ?? []
  );

  vinculadosHistoricosAlumno = computed(
    () => this.proyectosAlumno()?.vinculados_historicos ?? []
  );

  // ─────────────────────────────────────────────
  // Datos derivados: EVENTOS (noticiero)
  // ─────────────────────────────────────────────

  private todayYmd(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  /** Combina catálogo + mis eventos para saber si estoy inscrito o no. */
  private eventosVm = computed<EventoDashboardVM[]>(() => {
    const catalogo = this.eventosCatalogo() ?? [];
    const mis = this.misEventos()?.eventos ?? [];

    const participaciones = new Map<number, VmEventoParticipacionRef>();

    for (const e of mis as VmEventoAlumnoItem[]) {
      if (e.participacion && e.participacion.id) {
        participaciones.set(e.id, e.participacion);
      }
    }

    return catalogo.map<EventoDashboardVM>((ev) => ({
      id: ev.id,
      codigo: ev.codigo,
      titulo: ev.titulo,
      subtitulo: ev.subtitulo ?? null,
      descripcion_corta: ev.descripcion_corta ?? null,
      modalidad: ev.modalidad,
      estado: ev.estado,
      periodo_id: ev.periodo_id,
      periodo: ev.periodo ?? null,
      requiere_inscripcion: !!ev.requiere_inscripcion,
      cupo_maximo:
        ev.cupo_maximo !== null && ev.cupo_maximo !== undefined
          ? ev.cupo_maximo
          : null,
      inscripcion_desde: ev.inscripcion_desde ?? null,
      inscripcion_hasta: ev.inscripcion_hasta ?? null,
      participacion: participaciones.get(ev.id) ?? null,
    }));
  });

  /** Lógica de visibilidad:
   * - Solo PLANIFICADO o EN_CURSO.
   * - Si requiere inscripción → mostrar entre inscripcion_desde y inscripcion_hasta (si existen).
   * - Si no requiere inscripción → mostrar mientras esté activo.
   */
  private isEventoVisible(e: EventoDashboardVM): boolean {
    const today = this.todayYmd();

    // Solo eventos activos
    if (e.estado === 'CERRADO' || e.estado === 'CANCELADO') {
      return false;
    }

    const from = e.inscripcion_desde ?? null;
    const to = e.inscripcion_hasta ?? null;

    if (!e.requiere_inscripcion) {
      // Sin inscripción previa: visibles mientras estén activos
      return true;
    }

    if (from && today < from) return false;
    if (to && today > to) return false;

    return true;
  }

  /** Eventos que pasan todos los filtros y se muestran en el noticiero. */
  eventosAlumnoActivos = computed<EventoDashboardVM[]>(() =>
    this.eventosVm()
      .filter((e) => this.isEventoVisible(e))
      .sort((a, b) => {
        const aKey = `${a.inscripcion_desde ?? ''}${a.titulo}`;
        const bKey = `${b.inscripcion_desde ?? ''}${b.titulo}`;
        return aKey.localeCompare(bKey);
      })
  );

  /** Eventos visibles donde aún no estoy inscrito (o no hay inscripción previa). */
  eventosDisponiblesAlumno = computed<EventoDashboardVM[]>(() =>
    this.eventosAlumnoActivos().filter((e) => !e.participacion?.id)
  );

  /** Eventos visibles donde ya estoy inscrito. */
  eventosInscritosAlumno = computed<EventoDashboardVM[]>(() =>
    this.eventosAlumnoActivos().filter((e) => !!e.participacion?.id)
  );

  // ─────────────────────────────────────────────
  // Datos derivados: HORAS
  // ─────────────────────────────────────────────

  totalHoras = computed(
    () => this.miReporteHoras()?.resumen.total_horas ?? 0
  );

  horasPorPeriodo = computed<ResumenPorPeriodoItem[]>(() =>
    this.miReporteHoras()?.resumen.por_periodo ?? []
  );

  // ─────────────────────────────────────────────
  // Datos derivados: SESIONES PRÓXIMAS
  // ─────────────────────────────────────────────

  proximasSesionesAlumnoVm = computed<ProximaSesionVM[]>(() => {
    const agenda = this.agendaAlumno();
    if (!agenda || !Array.isArray(agenda)) return [];

    const items: ProximaSesionVM[] = [];

    for (const pa of agenda as AlumnoProyectoAgenda[]) {
      const proyecto = pa.proyecto;
      for (const pr of pa.procesos as AlumnoProcesoResumen[]) {
        for (const sesionRes of pr.sesiones as AlumnoSesion[]) {
          if (
            sesionRes.estado_relativo === 'PROXIMA' ||
            sesionRes.estado_relativo === 'ACTUAL'
          ) {
            items.push({
              sesion: sesionRes.sesion,
              proyecto,
              procesoNombre: pr.proceso.nombre,
              estado_relativo: sesionRes.estado_relativo,
            });
          }
        }
      }
    }

    items.sort(
      (a, b) =>
        this.combineDateTime(a.sesion.fecha, a.sesion.hora_inicio).getTime() -
        this.combineDateTime(b.sesion.fecha, b.sesion.hora_inicio).getTime()
    );

    return items.slice(0, 4);
  });

  // ─────────────────────────────────────────────
  // Helpers UI
  // ─────────────────────────────────────────────

  toggleLang() {
    this.lang = this.lang === 'es' ? 'en' : 'es';
    this.t.setActiveLang(this.lang);
    document.documentElement.lang = this.lang;
    localStorage.setItem('lang', this.lang);
  }

  private combineDateTime(fecha: string, hora: string | null | undefined): Date {
    const hhmm = hora && hora.length >= 4 ? hora : '00:00';
    return new Date(`${fecha}T${hhmm}`);
  }

  minToHoursLabel(min: number | null | undefined): string {
    if (!min || min <= 0) return '0 h';
    const h = Math.round((min / 60) * 10) / 10;
    return `${h} h`;
  }

  estadoBadgeClass(estado?: string | null): string {
    const s = String(estado ?? '').toUpperCase();
    if (s === 'PLANIFICADO') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'EN_CURSO') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'CERRADO' || s === 'FINALIZADO')
      return 'bg-slate-100 text-slate-700 border-slate-200';
    if (s === 'CANCELADO') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  modalidadBadgeClass(mod?: string | null): string {
    const s = String(mod ?? '').toUpperCase();
    if (s === 'PRESENCIAL') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (s === 'VIRTUAL') return 'bg-violet-50 text-violet-700 border-violet-200';
    if (s === 'MIXTA') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  estadoRelativoLabel(e: AlumnoSesionEstado): string {
    if (e === 'ACTUAL') return 'En curso';
    if (e === 'PROXIMA') return 'Próxima';
    if (e === 'PASADA') return 'Pasada';
    return e;
  }

  estadoRelativoClass(e: AlumnoSesionEstado): string {
    if (e === 'ACTUAL') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (e === 'PROXIMA')
      return 'bg-amber-100 text-amber-800 border-amber-200';
    if (e === 'PASADA')
      return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  }

  // Helpers para chip de inscripción / estado de participación
  eventoInscripcionLabel(e: EventoDashboardVM): string {
    if (!e.requiere_inscripcion) return 'Sin inscripción previa';
    if (e.participacion?.id) return 'Inscrito';
    return 'Inscripción abierta';
  }

  eventoInscripcionChipClass(e: EventoDashboardVM): string {
    const base =
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold';
    if (!e.requiere_inscripcion) {
      return `${base} bg-slate-50 text-slate-700 border-slate-200`;
    }
    if (e.participacion?.id) {
      return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
    }
    return `${base} bg-amber-50 text-amber-700 border-amber-200`;
  }
}
