import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EvApiService } from '../../data-access/ev-api.service';
import { Periodo } from '../../models/ev.models';

@Component({
  selector: 'ev-event-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-filters.component.html',
})
export class EventFiltersComponent implements OnInit {
  @Input() search = '';
  @Input() periodoId?: number;
  @Output() searchChange = new EventEmitter<string>();
  @Output() periodoChange = new EventEmitter<number | undefined>();
  @Output() crear = new EventEmitter<void>();

  periodos: Periodo[] = [];
  cargandoPeriodos = false;
  error?: string;

  constructor(private api: EvApiService) {}

  ngOnInit(): void { this.loadPeriodos(); }

  private loadPeriodos() {
    this.cargandoPeriodos = true;
    this.error = undefined;
    this.api.fetchPeriodos('', true, 50).subscribe({
      next: (per: Periodo[]) => {
        this.periodos = per;
        if (!this.periodoId) {
          const actual = per.find((p) => (p.estado || '').toUpperCase() === 'EN_CURSO');
          this.periodoId = actual?.id ?? per[0]?.id;
          this.emitPeriodo();
        }
      },
      error: () => (this.error = 'No se pudieron cargar los periodos.'),
      complete: () => (this.cargandoPeriodos = false),
    });
  }

  emitSearch() { this.searchChange.emit(this.search); }
  emitPeriodo() { this.periodoChange.emit(this.periodoId); }
}
