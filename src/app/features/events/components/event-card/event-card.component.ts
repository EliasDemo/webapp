// src/app/features/events/ui/event-card/event-card.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VmEvento } from '../../models/ev.models';

@Component({
  selector: 'ev-event-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-card.component.html',
})
export class EventCardComponent {
  @Input({ required: true }) evento!: VmEvento;
  @Output() ver = new EventEmitter<VmEvento>();

  get estadoColor(): string {
    // chips brutales
    switch (this.evento.estado) {
      case 'PLANIFICADO': return 'bg-[#00E0FF] text-black';
      case 'EN_CURSO':    return 'bg-green-400 text-black';
      case 'CERRADO':     return 'bg-gray-400 text-black';
      case 'CANCELADO':   return 'bg-red-400 text-black';
      default:            return 'bg-white text-black';
    }
  }

  /**
   * Texto resumen de las sesiones del evento para la tarjeta brutalista.
   */
  get resumenSesiones(): string {
    const sesiones = this.evento.sesiones ?? [];
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
