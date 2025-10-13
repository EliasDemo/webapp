import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { EvApiService, ApiResponse } from '../../data-access/ev-api.service';
import { VmEvento } from '../../models/ev.models';
import { EventFiltersComponent } from '../../components/event-filters/event-filters.component';
import { EventCardComponent } from '../../components/event-card/event-card.component';

@Component({
  selector: 'ev-events-list-page',
  standalone: true,
  imports: [CommonModule, EventFiltersComponent, EventCardComponent],
  templateUrl: './events-list.page.html',
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

  constructor(private api: EvApiService, private router: Router) {}

  ngOnInit(): void {
    this.search$.pipe(debounceTime(250), takeUntil(this.destroy$)).subscribe(() => this.load());
    this.load();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  onSearchChange(v: string) { this.search = v; this.page = 1; this.search$.next(); }
  onPeriodoChange(id?: number) { this.periodoId = id; this.page = 1; this.load(); }

  crearEvento() { this.router.navigate(['/events/new']); }
  verEvento(ev: VmEvento) { this.router.navigate(['/events', ev.id]); }

  load() {
    this.cargando = true;
    this.error = undefined;

    this.api
      .listarEventos({
        search: this.search || undefined,
        page: this.page,
        // periodo_id: this.periodoId, // si tu backend lo soporta
      } as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp: ApiResponse<VmEvento[]>) => {
          const rows = Array.isArray(resp.data) ? resp.data : [];
          const filtrados = this.periodoId ? rows.filter(r => r.periodo_id === this.periodoId) : rows;
          this.eventos = filtrados;
          this.total = resp.meta?.total ?? filtrados.length;
        },
        error: (err: any) => {
          console.error(err);
          this.error = 'No se pudieron cargar los eventos.';
        },
        complete: () => (this.cargando = false),
      });
  }
}
