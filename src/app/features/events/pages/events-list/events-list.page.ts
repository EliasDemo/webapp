// src/app/features/events/pages/events-list/events-list.page.ts
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EvApiService } from '../../data-access/ev-api.service';
import { VmEvento, EventoFilter } from '../../models/ev.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service';

@Component({
  standalone: true,
  selector: 'app-events-list-page',
  templateUrl: './events-list.page.html',
  imports: [CommonModule, FormsModule, RouterLink],
})
export class EventsListPage implements OnInit {
  private api = inject(EvApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private loader = inject(LoaderService);

  // -------------------------
  // Estado base
  // -------------------------

  loading = signal(false);
  errorMsg = signal<string | null>(null);

  eventos = signal<VmEvento[]>([]);
  total = signal(0);

  // paginación (Laravel paginate(15))
  readonly pageSize = 15;
  page = signal(1);

  // filtros
  estadoFilter = signal<string>('');        // PLANIFICADO | EN_CURSO | ...
  targetIdFilter = signal<number | null>(null);
  searchFilter = signal<string>('');

  // derivados
  totalPages = computed(() =>
    this.total() > 0
      ? Math.max(1, Math.ceil(this.total() / this.pageSize))
      : 1
  );

  fromItem = computed(() => {
    if (this.total() === 0) return 0;
    return (this.page() - 1) * this.pageSize + 1;
  });

  toItem = computed(() => {
    if (this.total() === 0) return 0;
    return Math.min(this.total(), this.page() * this.pageSize);
  });

  // -------------------------
  // Ciclo de vida
  // -------------------------

  ngOnInit(): void {
    // Sincroniza filtros con query params (?page=2&estado=PLANIFICADO...)
    this.route.queryParamMap.subscribe((pm) => {
      const pageRaw = pm.get('page');
      const page = pageRaw ? Number(pageRaw) : 1;
      this.page.set(Number.isFinite(page) && page > 0 ? page : 1);

      this.estadoFilter.set(pm.get('estado') ?? '');

      const targetRaw = pm.get('target_id');
      this.targetIdFilter.set(
        targetRaw && Number(targetRaw) > 0 ? Number(targetRaw) : null
      );

      this.searchFilter.set(pm.get('search') ?? '');

      void this.loadEventos();
    });
  }

  // -------------------------
  // Carga de eventos
  // -------------------------

  private async loadEventos(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);

    const filtro: EventoFilter = {
      page: this.page(),
    };

    if (this.estadoFilter()) filtro.estado = this.estadoFilter();
    if (this.targetIdFilter()) filtro.target_id = this.targetIdFilter()!;
    if (this.searchFilter().trim()) filtro.search = this.searchFilter().trim();

    this.loader
      .track(this.api.listarEventos(filtro), 'Cargando eventos...')
      .subscribe({
        next: (res) => {
          const page = res.data;
          this.eventos.set(page.items ?? []);
          this.total.set(page.total ?? (page.items?.length ?? 0));
        },
        error: (err) => {
          console.error(err);
          this.eventos.set([]);
          this.total.set(0);
          this.errorMsg.set(
            err?.error?.message ||
              'No se pudieron cargar los eventos.'
          );
          this.loading.set(false);
        },
        complete: () => {
          this.loading.set(false);
        },
      });
  }

  // -------------------------
  // Filtros / navegación
  // -------------------------

  onTargetIdChange(raw: string | number | null): void {
    const n = Number(raw);
    this.targetIdFilter.set(
      Number.isFinite(n) && n > 0 ? n : null
    );
  }

  aplicarFiltros(): void {
    const queryParams: any = { page: 1 };

    if (this.estadoFilter()) queryParams.estado = this.estadoFilter();
    if (this.targetIdFilter()) queryParams.target_id = this.targetIdFilter();
    if (this.searchFilter().trim())
      queryParams.search = this.searchFilter().trim();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  limpiarFiltros(): void {
    this.estadoFilter.set('');
    this.targetIdFilter.set(null);
    this.searchFilter.set('');

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: 1, estado: null, target_id: null, search: null },
      queryParamsHandling: 'merge',
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.page() || page > this.totalPages()) return;

    const queryParams = {
      ...this.route.snapshot.queryParams,
      page,
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  // -------------------------
  // Helpers
  // -------------------------

  trackEvento = (_: number, ev: VmEvento) => ev.id;

  prettyEstado(estado: VmEvento['estado']): string {
    switch (estado) {
      case 'PLANIFICADO':
        return 'Planificado';
      case 'EN_CURSO':
        return 'En curso';
      case 'CERRADO':
        return 'Cerrado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return estado;
    }
  }

  prettyTargetType(t: VmEvento['targetable_type']): string {
    switch (t) {
      case 'ep_sede':
        return 'EP-Sede';
      case 'sede':
        return 'Sede';
      case 'facultad':
        return 'Facultad';
      default:
        return t;
    }
  }

  /**
   * Texto resumen de las sesiones de un evento.
   */
  sesionesResumen(ev: VmEvento): string {
    const sesiones = ev.sesiones ?? [];
    if (!sesiones.length) {
      return 'Sin sesiones';
    }

    const sorted = [...sesiones].sort((a, b) => {
      const aKey = `${a.fecha} ${a.hora_inicio}`;
      const bKey = `${b.fecha} ${b.hora_inicio}`;
      return aKey.localeCompare(bKey);
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (sorted.length === 1) {
      return `${first.fecha} · ${first.hora_inicio}–${first.hora_fin}`;
    }

    return `${sorted.length} sesiones · ${first.fecha} ${first.hora_inicio} → ${last.fecha} ${last.hora_fin}`;
  }
}
