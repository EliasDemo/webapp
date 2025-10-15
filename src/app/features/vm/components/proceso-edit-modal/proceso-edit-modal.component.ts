import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { Id, ProcesoCreate, VmProceso, isApiOk, TipoRegistro } from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proceso-edit-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proceso-edit-modal.component.html',
})
export class ProcesoEditModalComponent {
  private fb  = inject(FormBuilder);
  private api = inject(VmApiService);

  @Input() procesoId!: Id;
  @Input() initial!: VmProceso;
  @Output() saved  = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  busy = false;
  serverError: string | null = null;

  form = this.fb.group({
    nombre: this.fb.nonNullable.control<string>('', [Validators.required, Validators.maxLength(255)]),
    descripcion: this.fb.control<string>(''),
    tipo_registro: this.fb.nonNullable.control<TipoRegistro>('HORAS', Validators.required),
    horas_asignadas: this.fb.control<number | null>(null),
    nota_minima: this.fb.control<number | null>(null),
    requiere_asistencia: this.fb.nonNullable.control<boolean>(false),
    orden: this.fb.control<number | null>(1, [Validators.min(1)]),
  });

  ngOnInit() {
    const p = this.initial;
    this.form.patchValue({
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      tipo_registro: p.tipo_registro,
      horas_asignadas: p.horas_asignadas,
      nota_minima: p.nota_minima,
      requiere_asistencia: p.requiere_asistencia,
      orden: p.orden,
    });

    // Reglas dinámicas según tipo_registro
    this.form.get('tipo_registro')!.valueChanges.subscribe((t) => {
      const horasCtrl = this.form.get('horas_asignadas')!;
      const notaCtrl  = this.form.get('nota_minima')!;
      // reset validators
      horasCtrl.clearValidators();
      notaCtrl.clearValidators();
      // aplica requeridos según tipo
      if (t === 'HORAS' || t === 'MIXTO') {
        horasCtrl.addValidators([Validators.required, Validators.min(0), Validators.max(32767)]);
      }
      if (t === 'EVALUACION' || t === 'MIXTO') {
        notaCtrl.addValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      }
      horasCtrl.updateValueAndValidity({ emitEvent: false });
      notaCtrl.updateValueAndValidity({ emitEvent: false });
    });
  }

  closeByBackdrop() { if (!this.busy) this.closed.emit(); }

  async submit() {
    if (this.form.invalid || this.busy) return;
    this.serverError = null;
    this.busy = true;
    try {
      const v = this.form.getRawValue();
      const payload: Partial<ProcesoCreate> = {
        nombre: v.nombre,
        descripcion: v.descripcion ?? null,
        tipo_registro: v.tipo_registro,
        requiere_asistencia: v.requiere_asistencia,
        horas_asignadas: v.horas_asignadas != null ? Number(v.horas_asignadas) : null,
        nota_minima: v.nota_minima != null ? Number(v.nota_minima) : null,
        orden: v.orden != null ? Number(v.orden) : null,
      };

      const resp = await firstValueFrom(this.api.actualizarProcesoById(this.procesoId, payload));
      if (resp && isApiOk(resp)) this.saved.emit();
      else this.serverError = (resp as any)?.message || 'No se pudo guardar.';
    } catch (e: any) {
      this.serverError = e?.error?.message || 'Error del servidor.';
    } finally { this.busy = false; }
  }
}
