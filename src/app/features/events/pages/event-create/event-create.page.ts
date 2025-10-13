import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EvApiService, ApiResponse } from '../../data-access/ev-api.service';
import { VmEvento, Periodo } from '../../models/ev.models';

@Component({
  selector: 'ev-event-create-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './event-create.page.html',
})
export class EventCreatePage implements OnInit {
  cargando = false;
  periodos: Periodo[] = [];
  error?: string;

  form: Partial<VmEvento> = {
    titulo: '',
    periodo_id: undefined,
    targetable_type: 'ep_sede',
    targetable_id: 1,
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    requiere_inscripcion: false,
    cupo_maximo: null,
  };

  constructor(private api: EvApiService, private router: Router) {}

  ngOnInit() { this.loadPeriodos(); }

  private loadPeriodos() {
    this.error = undefined;
    this.api.fetchPeriodos('', true).subscribe({
      next: (per: Periodo[]) => {
        this.periodos = per;
        const actual = per.find((p) => (p.estado || '').toUpperCase() === 'EN_CURSO');
        this.form.periodo_id = actual?.id ?? per[0]?.id;
      },
      error: () => (this.error = 'No se pudieron cargar los periodos.'),
    });
  }

  crearEvento() {
    if (!this.form.titulo || !this.form.fecha || !this.form.hora_inicio || !this.form.hora_fin || !this.form.periodo_id) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    this.cargando = true;
    this.api.crearEvento(this.form).subscribe({
      next: (resp: ApiResponse<VmEvento>) => {
        alert('✅ Evento creado correctamente.');
        this.router.navigate(['/events', resp.data.id]);
      },
      error: (err: any) => {
        console.error(err);
        alert(err?.error?.message ?? '❌ Ocurrió un error al crear el evento.');
      },
      complete: () => (this.cargando = false),
    });
  }
}
