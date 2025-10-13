import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VmProyecto } from '../../../vm/models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-card-2',
  imports: [CommonModule],
  templateUrl: './proyecto-card-2.component.html',
  styleUrls: ['./proyecto-card-2.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoCard2Component {
  @Input() proyecto!: VmProyecto;

  /** Mostrar u ocultar el botón principal (CTA). En “inscritos” normalmente va en false */
  @Input() showCta = true;

  /** Texto del botón principal (por defecto “Inscribirse”) */
  @Input() ctaText = 'Inscribirse';

  @Output() inscribirse = new EventEmitter<number>();

  get imageSrc(): string {
    if (this.proyecto?.cover_url) return this.proyecto.cover_url;
    const mod = (this.proyecto?.modalidad || '').toUpperCase();
    if (mod === 'PRESENCIAL') return 'assets/proyectos/presencial.svg';
    if (mod === 'VIRTUAL')    return 'assets/proyectos/virtual.svg';
    if (mod === 'MIXTA')      return 'assets/proyectos/mixta.svg';
    return 'assets/proyectos/default.svg';
    // Puedes poner un fallback remoto si quieres, pero así evitas CORS/latencias.
  }

  onInscribirse() {
    if (!this.proyecto) return;
    this.inscribirse.emit(this.proyecto.id);
  }
}
