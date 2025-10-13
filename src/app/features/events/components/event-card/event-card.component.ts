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
}
