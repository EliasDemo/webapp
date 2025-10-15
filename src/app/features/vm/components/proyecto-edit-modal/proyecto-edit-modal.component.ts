import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { Id, ProyectoCreate, VmProyecto, isApiOk, TipoProyecto, Modalidad } from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-edit-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proyecto-edit-modal.component.html',
})
export class ProyectoEditModalComponent {
  private fb  = inject(FormBuilder);
  private api = inject(VmApiService);

  @Input() proyectoId!: Id;
  @Input() initial!: VmProyecto;
  @Output() saved  = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  busy = false;
  serverError: string | null = null;

  form = this.fb.group({
    titulo: this.fb.nonNullable.control<string>('', [Validators.required, Validators.maxLength(255)]),
    descripcion: this.fb.control<string>(''),
    codigo: this.fb.control<string>(''),
    tipo: this.fb.nonNullable.control<TipoProyecto>('LIBRE', Validators.required),
    modalidad: this.fb.nonNullable.control<Modalidad>('PRESENCIAL', Validators.required),
    nivel: this.fb.control<number | null>(null),
    horas_planificadas: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0)]),
    horas_minimas_participante: this.fb.control<number | null>(null),
  });

  ngOnInit() {
    const p = this.initial;
    this.form.patchValue({
      titulo: p.titulo,
      descripcion: p.descripcion ?? '',
      codigo: p.codigo ?? '',
      tipo: p.tipo,
      modalidad: p.modalidad,
      nivel: p.nivel,
      horas_planificadas: p.horas_planificadas,
      horas_minimas_participante: p.horas_minimas_participante,
    });
  }

  closeByBackdrop() { if (!this.busy) this.closed.emit(); }

  async submit() {
    if (this.form.invalid || this.busy) return;
    this.serverError = null;
    this.busy = true;
    try {
      const v = this.form.getRawValue();
      const payload: Partial<ProyectoCreate> = {
        titulo: v.titulo,
        descripcion: v.descripcion ?? null,
        codigo: v.codigo ?? null,
        tipo: v.tipo,
        modalidad: v.modalidad,
        nivel: v.nivel ?? null,
        horas_planificadas: Number(v.horas_planificadas),
        horas_minimas_participante: v.horas_minimas_participante ?? null,
      };

      const resp = await firstValueFrom(this.api.actualizarProyecto(this.proyectoId, payload));
      if (resp && isApiOk(resp)) this.saved.emit();
      else this.serverError = (resp as any)?.message || 'No se pudo guardar.';
    } catch (e: any) {
      this.serverError = e?.error?.message || 'Error del servidor.';
    } finally { this.busy = false; }
  }
}
