import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  Subject,
  debounceTime,
  takeUntil,
  finalize,
  observeOn,
  asyncScheduler,
} from 'rxjs';
import { EvApiService, ApiResponse } from '../../data-access/ev-api.service';
import { VmEvento } from '../../models/ev.models';
import { EventFiltersComponent } from '../../components/event-filters/event-filters.component';
import { EventCardComponent } from '../../components/event-card/event-card.component';

@Component({
  selector: 'ev-events-list-page',
  standalone: true,
  imports: [CommonModule, EventFiltersComponent, EventCardComponent],
  templateUrl: './events-list.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsListPage implements OnInit, OnDestroy {
  eventos: VmEvento[] = [];
  search = '';
  periodoId?: number;

  page = 1;
  total = 0;
  pageSize = 15;

  cargando = false;
  error?: string;

  private search$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private api: EvApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Búsqueda con debounce (si cambia search, recarga)
    this.search$
      .pipe(debounceTime(250), takeUntil(this.destroy$))
      .subscribe(() => this.load());

    // Carga inicial
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalPages(): number {
    return this.pageSize > 0 ? Math.ceil(this.total / this.pageSize) : 0;
  }

  onSearchChange(v: string) {
    this.search = v ?? '';
    this.page = 1;
    this.search$.next();
  }

  onPeriodoChange(id?: number) {
    this.periodoId = id;
    this.page = 1;
    this.load();
  }

  crearEvento() {
    this.router.navigate(['/events/new']);
  }

  verEvento(ev: VmEvento) {
    this.router.navigate(['/events', ev.id]);
  }

  prevPage() {
    if (this.page > 1) {
      this.page--;
      this.load();
    }
  }

  nextPage() {
    if (this.page < this.totalPages) {
      this.page++;
      this.load();
    }
  }

  trackByEventoId = (_: number, ev: VmEvento) => ev.id;

  load() {
    this.cargando = true;
    this.error = undefined;
    // OnPush: marcamos para renderizar el estado "cargando"
    this.cdr.markForCheck();

    this.api
      .listarEventos({
        search: this.search || undefined,
        page: this.page,
        // periodo_id: this.periodoId, // Descomenta si tu backend lo soporta
      } as any)
      .pipe(
        // Fuerza que todas las notificaciones y complete sean asíncronas
        observeOn(asyncScheduler),
        takeUntil(this.destroy$),
        finalize(() => {
          // Evita NG0100 si la fuente completa de forma inmediata
          queueMicrotask(() => {
            this.cargando = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: (resp: ApiResponse<VmEvento[]>) => {
          const rows = Array.isArray(resp.data) ? resp.data : [];

          const filtrados = this.periodoId
            ? rows.filter((r) => r.periodo_id === this.periodoId)
            : rows;

          this.eventos = filtrados;
          this.total = resp.meta?.total ?? filtrados.length;

          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          // Mantén el log si te sirve en dev
          console.error(err);
          this.error = 'No se pudieron cargar los eventos.';
          // Si hay error, vaciamos la lista para que el template no mezcle estados
          this.eventos = [];
          this.total = 0;

          this.cdr.markForCheck();
        },
      });
  }
}
