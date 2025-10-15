import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { Id, VmSesion, isApiOk } from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-sesion-edit-modal',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sesion-edit-modal.component.html',
})
export class SesionEditModalComponent {
  private fb  = inject(FormBuilder);
  private api = inject(VmApiService);

  @Input() sesionId!: Id;
  @Input() initial!: VmSesion;
  @Output() saved  = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  busy = false;
  serverError: string | null = null;

  form = this.fb.group({
    fecha: this.fb.nonNullable.control<string>('', [Validators.required]),
    hora_inicio: this.fb.nonNullable.control<string>('', [Validators.required]),
    hora_fin: this.fb.nonNullable.control<string>('', [Validators.required]),
    // Campos opcionales soportados por el backend (si existen en tu modelo):
    lugar: this.fb.control<string | null>(null),
    enlace: this.fb.control<string | null>(null),
    observacion: this.fb.control<string | null>(null),
  });

  ngOnInit() {
    const s = this.initial;
    this.form.patchValue({
      fecha: s.fecha,
      hora_inicio: s.hora_inicio,
      hora_fin: s.hora_fin,
    });
  }

  closeByBackdrop() { if (!this.busy) this.closed.emit(); }

  async submit() {
    if (this.form.invalid || this.busy) return;
    this.serverError = null;
    this.busy = true;
    try {
      const v = this.form.getRawValue();
      // PUT /vm/sesiones/{sesion}
      const resp = await firstValueFrom(this.api.actualizarSesionById(this.sesionId, {
        fecha: v.fecha,
        hora_inicio: v.hora_inicio,
        hora_fin: v.hora_fin,
        lugar: v.lugar ?? undefined,
        enlace: v.enlace ?? undefined,
        observacion: v.observacion ?? undefined,
      } as any));
      if (resp && isApiOk(resp)) this.saved.emit();
      else this.serverError = (resp as any)?.message || 'No se pudo guardar.';
    } catch (e: any) {
      this.serverError = e?.error?.message || 'Error del servidor.';
    } finally { this.busy = false; }
  }
}
