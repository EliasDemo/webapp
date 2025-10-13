import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { LookupsApiService } from '../../lookups/lookups.api';

/** Type guard: valida si una respuesta tiene 'data' */
function hasData<T>(res: any): res is { ok: true; data: T } {
  return res && typeof res === 'object' && 'data' in res && res.ok === true;
}

type ImgItem = { file: File; preview: string };

// NEW: tipos auxiliares período
type PeriodoItem = { id: number; codigo?: string; anio?: string|number; ciclo?: string|number; estado?: string; fecha_inicio?: string; fecha_fin?: string };

@Component({
  standalone: true,
  selector: 'app-proyecto-wizard-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './proyecto-wizard.page.html'
})
export class ProyectoWizardPage implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(VmApiService);
  private lookups = inject(LookupsApiService);
  private router = inject(Router);

  step = signal<1 | 2>(1);
  submitting = signal(false);
  rollingBack = signal(false);
  showCancel = signal(false);

  serverErr = signal<string | null>(null);
  // NEW: errores de campo provenientes del servidor
  serverFieldErrors = signal<Record<string, string[]>>({});

  epOptions = signal<{ value: number; label: string }[]>([]);
  perOptions = signal<{ value: number; label: string; estado?: string }[]>([]);
  nivelesDisponibles = signal<number[]>(Array.from({ length: 10 }, (_, i) => i + 1));

  // NEW: índice de periodos por id para validar fechas
  private periodosIndex: Record<number, { inicio?: string; fin?: string; codigo?: string }> = {};

  imagenes = signal<ImgItem[]>([]);
  private subscriptions: Subscription[] = [];
  private createdProyectoId: number | null = null;

  form = this.fb.group({
    ep_sede_id: this.fb.control<number | null>(null, [Validators.required]),
    periodo_id: this.fb.control<number | null>(null, [Validators.required]),
    codigo: this.fb.control<string | null>(''),
    titulo: this.fb.control<string>('', [Validators.required, Validators.minLength(3)]),
    descripcion: this.fb.control<string | null>(''),
    tipo: this.fb.control<'VINCULADO' | 'LIBRE'>('VINCULADO', [Validators.required]),
    modalidad: this.fb.control<'PRESENCIAL' | 'VIRTUAL' | 'MIXTA'>('PRESENCIAL', [Validators.required]),
    nivel: this.fb.control<number | null>(null),
    horas_planificadas: this.fb.control<number>(5, [Validators.required, Validators.min(1)]),
    procesos: this.fb.array<FormGroup>([])
  });

  get procesosFA(): FormArray<FormGroup> {
    return this.form.get('procesos') as FormArray<FormGroup>;
  }

  tipo = computed(() => this.form.get('tipo')!.value ?? 'VINCULADO');
  procesos = computed(() => this.procesosFA.controls);
  hasError = (c: string) =>
    !!this.form.get(c)?.invalid && (this.form.get(c)?.touched || this.form.get(c)?.dirty);

  // ======= Helpers errores de servidor (NEW) =======
  private pathKey(path: (string | number)[]): string {
    return path.map(p => typeof p === 'number' ? `[${p}]` : p).join('.');
  }

  getSvr(path: (string | number)[]) {
    const k = this.pathKey(path);
    const map = this.serverFieldErrors();
    const arr = map[k];
    return arr?.length ? arr[0] : null;
  }

  private clearServerErrors() {
    this.serverFieldErrors.set({});
  }

  private extractServerValidation(err: any): { message: string; fields: Record<string, string[]> } {
    let message = 'Datos inválidos.';
    const fields: Record<string, string[]> = {};
    const body = err?.error ?? err;

    if (typeof body === 'string') message = body;
    if (body?.message) message = body.message;

    // Laravel-like { errors: { field: [msg] } }
    if (body?.errors && typeof body.errors === 'object') {
      for (const [k, v] of Object.entries(body.errors)) {
        fields[k] = Array.isArray(v) ? v as string[] : [String(v)];
      }
    }
    // ProblemDetails / violations
    if (Array.isArray(body?.violations)) {
      for (const it of body.violations) {
        const key = String(it.propertyPath || it.field || it.name || 'general');
        const msg = String(it.message || it.reason || 'Inválido');
        (fields[key] ||= []).push(msg);
      }
    }
    // { fieldErrors: [{ field, message }] }
    if (Array.isArray(body?.fieldErrors)) {
      for (const it of body.fieldErrors) {
        const key = String(it.field || 'general');
        const msg = String(it.message || 'Inválido');
        (fields[key] ||= []).push(msg);
      }
    }
    // Mensaje especial de ProcesoSesionController
    if (Array.isArray(body?.fechas_fuera) && (body?.rango?.length === 2)) {
      message = body.message || 'Hay fechas fuera del período del proyecto.';
      // mapea al primer campo de fecha del primer proceso/sesión (orientativo)
      (fields['fechas'] ||= []).push(`Fuera del periodo: ${body.rango[0]} a ${body.rango[1]}.`);
    }

    return { message, fields };
  }

  // ======= Cálculos de horas =======
  // NEW: sólo cuentan procesos que requieren horas
  private isHoursDriven(idx: number): boolean {
    const t = (this.procesosFA.at(idx).get('tipo_registro')!.value || 'HORAS') as string;
    return t === 'HORAS' || t === 'MIXTO';
  }
  private isEvalDriven(idx: number): boolean {
    const t = (this.procesosFA.at(idx).get('tipo_registro')!.value || 'HORAS') as string;
    return t === 'EVALUACION' || t === 'MIXTO';
  }

  totalAsignadas(): number {
    return this.procesosFA.controls
      .map((g, i) => this.isHoursDriven(i) ? Number(g.get('horas_asignadas')!.value || 0) : 0)
      .reduce((a, b) => a + b, 0);
  }

  remainingProject(): number {
    const plan = Number(this.form.get('horas_planificadas')!.value || 0);
    return Math.max(0, plan - this.totalAsignadas());
  }

  sumIgualPlan(): boolean {
    const plan = Number(this.form.get('horas_planificadas')!.value || 0);
    return Math.abs(this.totalAsignadas() - plan) <= 1e-6;
  }

  getHorasAsignadas(idx: number): number {
    const g = this.procesosFA.at(idx);
    return this.isHoursDriven(idx) ? Number(g.get('horas_asignadas')!.value || 0) : 0;
  }

  usedHoursProceso(idx: number): number {
    const sesFA = this.sesiones(idx);
    return sesFA.controls
      .map(sg => Number(sg.get('duracion_horas')!.value || 0))
      .reduce((a, b) => a + b, 0);
  }

  remainingHorasProceso(idx: number): number {
    if (!this.isHoursDriven(idx)) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.getHorasAsignadas(idx) - this.usedHoursProceso(idx));
  }

  maxAsignablesParaProceso(idx: number): number {
    if (!this.isHoursDriven(idx)) return 0;
    const plan = Number(this.form.get('horas_planificadas')!.value || 0);
    const current = this.getHorasAsignadas(idx);
    const others = this.totalAsignadas() - current;
    return Math.max(0, plan - others);
  }

  // No permitir menos de lo ya usado en sesiones, mínimo entero (backend exige integer)
  minAsignadas(pi: number): number {
    if (!this.isHoursDriven(pi)) return 0;
    const used = this.usedHoursProceso(pi);
    return Math.max(1, Math.ceil(used)); // entero
  }

  canAddProceso(): boolean {
    // Sólo limitamos por horas planificadas cuando el nuevo proceso es hours-driven.
    // Permitimos agregar el proceso; el usuario decidirá tipo_registro.
    return true;
  }

  // Solo se limita por remanente si es HORAS/MIXTO
  canAddSesion(idx: number): boolean {
    return this.isHoursDriven(idx) ? this.remainingHorasProceso(idx) > 0 : true;
  }

  // ======= Ciclo de vida =======
  ngOnInit(): void {
    this.loadLookups();
    this.addProceso(true);

    this.subscriptions.push(
      this.form.get('tipo')!.valueChanges.subscribe(async (t) => {
        if (t === 'LIBRE') {
          this.form.get('nivel')!.setValue(null);
          this.form.get('nivel')!.disable({ emitEvent: false });
        } else {
          this.form.get('nivel')!.enable({ emitEvent: false });
          const ep = this.form.get('ep_sede_id')!.value;
          const per = this.form.get('periodo_id')!.value;
          if (ep && per) await this.loadNivelesDisponibles(ep, per);
        }
      }),
      this.form.get('ep_sede_id')!.valueChanges.subscribe(async (ep) => {
        if (this.form.get('tipo')!.value === 'VINCULADO') {
          const per = this.form.get('periodo_id')!.value;
          if (ep && per) await this.loadNivelesDisponibles(ep, per);
        }
      }),
      this.form.get('periodo_id')!.valueChanges.subscribe(async (per) => {
        if (this.form.get('tipo')!.value === 'VINCULADO') {
          const ep = this.form.get('ep_sede_id')!.value;
          if (ep && per) await this.loadNivelesDisponibles(ep, per);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.imagenes().forEach((i) => URL.revokeObjectURL(i.preview));
  }

  // ---------- Files ----------
  onFilesSelected(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;
    const next: ImgItem[] = [];
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      if (f.size > 5 * 1024 * 1024) return;
      next.push({ file: f, preview: URL.createObjectURL(f) });
    });
    this.imagenes.set([...this.imagenes(), ...next]);
    input.value = '';
  }

  removeImage(i: number) {
    const item = this.imagenes()[i];
    if (item) URL.revokeObjectURL(item.preview);
    this.imagenes.set(this.imagenes().filter((_, idx) => idx !== i));
  }

  // ---------- Paso 1 → Paso 2 ----------
  async goNext() {
    this.serverErr.set(null);
    this.clearServerErrors();
    this.form.markAllAsTouched();

    const controls = ['ep_sede_id', 'periodo_id', 'titulo', 'horas_planificadas'];
    if (this.tipo() === 'VINCULADO') controls.push('nivel');

    if (controls.some((c) => this.form.get(c)!.invalid)) return;
    this.step.set(2);
  }

  // ---------- Procesos / Sesiones ----------
  addProceso(initial = false) {
    const g = this.fb.group({
      nombre: this.fb.control<string>(
        initial ? 'Proceso Principal' : `Proceso ${this.procesosFA.length + 1}`,
        [Validators.required, Validators.minLength(3)]
      ),
      // BACKEND: integer, requerido solo HORAS|MIXTO (NEW)
      horas_asignadas: this.fb.control<number | null>(1, [Validators.min(1)]),

      tipo_registro: this.fb.control<'HORAS' | 'ASISTENCIA' | 'EVALUACION' | 'MIXTO'>(
        'HORAS', [Validators.required]
      ),
      // NEW: requerido para EVALUACION|MIXTO
      nota_minima: this.fb.control<number | null>(null),
      descripcion: this.fb.control<string | null>(''),
      requiere_asistencia: this.fb.control<boolean>(false),
      sesiones: this.fb.array<FormGroup>([])
    });

    this.procesosFA.push(g);
    const idx = this.procesosFA.length - 1;

    const horasCtrl = g.get('horas_asignadas')!;
    const tipoCtrl = g.get('tipo_registro')!;
    const notaCtrl = g.get('nota_minima')!;

    // NEW: aplica validadores condicionales según tipo_registro
    const applyTipoRules = () => {
      const t = tipoCtrl.value!;
      // horas_asignadas: requerido sólo HORAS|MIXTO
      if (t === 'HORAS' || t === 'MIXTO') {
        horasCtrl.enable({ emitEvent: false });
        horasCtrl.setValidators([Validators.required, Validators.min(this.minAsignadas(idx)), Validators.max(this.maxAsignablesParaProceso(idx) || 32767)]);
      } else {
        horasCtrl.setValue(null, { emitEvent: false });
        horasCtrl.clearValidators();
        horasCtrl.disable({ emitEvent: false });
      }
      horasCtrl.updateValueAndValidity({ emitEvent: false });

      // nota_minima: requerido EVALUACION|MIXTO (0..100)
      if (t === 'EVALUACION' || t === 'MIXTO') {
        notaCtrl.enable({ emitEvent: false });
        notaCtrl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      } else {
        notaCtrl.setValue(null, { emitEvent: false });
        notaCtrl.clearValidators();
        notaCtrl.disable({ emitEvent: false });
      }
      notaCtrl.updateValueAndValidity({ emitEvent: false });
    };
    applyTipoRules();

    const subTipo = tipoCtrl.valueChanges.subscribe(() => applyTipoRules());
    this.subscriptions.push(subTipo);

    // Limitar horas_asignadas contra plan y sesiones usadas (NEW entero)
    const subHoras = horasCtrl.valueChanges.subscribe((v) => {
      if (!this.isHoursDriven(idx)) return;
      let val = Math.max(1, Math.floor(Number(v || 0)));
      const min = Math.max(1, Math.ceil(this.usedHoursProceso(idx)));
      const max = this.maxAsignablesParaProceso(idx) || 0;
      if (val < min) val = min;
      if (max > 0 && val > max) val = max;
      if (val !== Number(horasCtrl.value)) {
        horasCtrl.setValue(val, { emitEvent: false });
      }
      // Ajustar sesiones si quedaron fuera de rango
      this.adjustSesionesToLimit(idx);
    });
    this.subscriptions.push(subHoras);
  }

  removeProceso(index: number) {
    this.procesosFA.removeAt(index);
  }

  sesiones(procIdx: number): FormArray<FormGroup> {
    return this.procesosFA.at(procIdx).get('sesiones') as FormArray<FormGroup>;
  }

  addSesion(procIdx: number) {
    if (!this.canAddSesion(procIdx)) return;

    const fa = this.sesiones(procIdx);
    // Si no es hours-driven, sugiere 1h; si lo es, respeta remanente
    const initialDur = this.isHoursDriven(procIdx) ? Math.min(1, this.remainingHorasProceso(procIdx)) : 1;

    const sg = this.fb.group({
      fecha: this.fb.control<string>('', [Validators.required]),
      hora_inicio: this.fb.control<string>('', [
        Validators.required,
        Validators.pattern(/^\d{2}:\d{2}$/)
      ]),
      duracion_horas: this.fb.control<number>(initialDur || 1, [
        Validators.required,
        Validators.min(0.5),
        Validators.max(24)
      ]),
      hora_fin: this.fb.control<string>('') // autocalculado
    });

    const sub = sg.valueChanges.subscribe((v) => {
      // hora_fin auto (no se permite cruzar medianoche por regla backend)
      const hf = this.calcHoraFin(v.hora_inicio, v.duracion_horas);
      if (hf) sg.get('hora_fin')!.setValue(hf, { emitEvent: false });

      // Capar duración al remanente sólo si aplica horas
      if (this.isHoursDriven(procIdx)) {
        const currentDur = Number(sg.get('duracion_horas')!.value || 0);
        const capProceso = this.remainingHorasProceso(procIdx) + currentDur; // suma con lo actual
        const cap = Math.max(0.5, Math.min(24, capProceso));
        if (currentDur > cap) {
          sg.get('duracion_horas')!.setValue(Number(cap.toFixed(1)), { emitEvent: false });
        }
        // Si el conjunto de sesiones supera asignadas, ajustar
        this.adjustSesionesToLimit(procIdx);
      }
    });
    this.subscriptions.push(sub);

    fa.push(sg);
  }

  removeSesion(procIdx: number, sesIdx: number) {
    this.sesiones(procIdx).removeAt(sesIdx);
  }

  private adjustSesionesToLimit(procIdx: number) {
    if (!this.isHoursDriven(procIdx)) return;
    // si sesiones superan horas_asignadas, recortar empezando por la última
    let rest = this.remainingHorasProceso(procIdx); // >= 0 si ok; negativo si excede
    if (rest >= 0) return;

    const sesFA = this.sesiones(procIdx);
    let exceso = -rest;
    for (let i = sesFA.length - 1; i >= 0 && exceso > 0; i--) {
      const sg = sesFA.at(i);
      const d = Number(sg.get('duracion_horas')!.value || 0);
      if (d <= exceso) {
        exceso -= d;
        sesFA.removeAt(i);
      } else {
        const nuevo = Number((d - exceso).toFixed(1));
        sg.get('duracion_horas')!.setValue(nuevo, { emitEvent: true });
        exceso = 0;
      }
    }
  }

  private calcHoraFin(horaInicio?: string | null, dur?: number | null): string | null {
    if (!horaInicio || !/^\d{2}:\d{2}$/.test(horaInicio) || !dur || dur <= 0) return null;
    const [hh, mm] = horaInicio.split(':').map(Number);
    const start = new Date();
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + dur * 60 * 60 * 1000);
    // Si cruza medianoche → backend lo rechaza. Mantén sólo HH:mm de la misma fecha:
    if (end.getDate() !== start.getDate()) {
      return null; // invalidará el campo y el validador cliente lo detectará
    }
    const hh2 = String(end.getHours()).padStart(2, '0');
    const mm2 = String(end.getMinutes()).padStart(2, '0');
    return `${hh2}:${mm2}`;
  }

  // ======= Validaciones previas al submit (NEW) =======
  private validateProcesosHoursNotExceed(): string | null {
    for (let i = 0; i < this.procesosFA.length; i++) {
      if (!this.isHoursDriven(i)) continue;
      const g = this.procesosFA.at(i);
      const asignadas = Number(g.get('horas_asignadas')!.value || 0);
      const sesFA = g.get('sesiones') as FormArray<FormGroup>;
      const sum = sesFA.controls
        .map((sg) => Number(sg.get('duracion_horas')!.value || 0))
        .reduce((a, b) => a + b, 0);
      if (sum > asignadas + 1e-6) {
        return `En "${g.get('nombre')!.value}": las horas de las sesiones (${sum}) no pueden exceder las asignadas (${asignadas}).`;
      }
    }
    return null;
  }

  private hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  private validateSessionTimeRanges(): { path: (string|number)[], message: string } | null {
    for (let pi = 0; pi < this.procesosFA.length; pi++) {
      const sesFA = this.sesiones(pi);
      for (let si = 0; si < sesFA.length; si++) {
        const sg = sesFA.at(si);
        const hi = String(sg.get('hora_inicio')!.value || '');
        const hf = String(sg.get('hora_fin')!.value || '');
        if (!/^\d{2}:\d{2}$/.test(hi) || !/^\d{2}:\d{2}$/.test(hf)) continue;
        const mi = this.hhmmToMinutes(hi);
        const mf = this.hhmmToMinutes(hf);
        if (mf <= mi) {
          return {
            path: ['procesos', pi, 'sesiones', si, 'hora_fin'],
            message: 'La hora fin debe ser mayor que la hora inicio y no puede cruzar medianoche.'
          };
        }
      }
    }
    return null;
  }

  private validateFechasDentroPeriodo(): { path: (string|number)[], message: string } | null {
    const perId = this.form.get('periodo_id')!.value!;
    const rango = this.periodosIndex[perId] || {};
    if (!rango.inicio || !rango.fin) return null; // no podemos validar si no hay datos

    for (let pi = 0; pi < this.procesosFA.length; pi++) {
      const sesFA = this.sesiones(pi);
      for (let si = 0; si < sesFA.length; si++) {
        const f = String(sesFA.at(si).get('fecha')!.value || '');
        if (!f) continue;
        if (!(rango.inicio <= f && f <= rango.fin)) {
          return {
            path: ['procesos', pi, 'sesiones', si, 'fecha'],
            message: `La fecha debe estar entre ${rango.inicio} y ${rango.fin}.`
          };
        }
      }
    }
    return null;
  }

  // Agrupa sesiones por (hora_inicio,hora_fin) para /sesiones/batch (NEW)
  private buildBatchPayloads(procIdx: number): Array<{ mode: 'list'; hora_inicio: string; hora_fin: string; fechas: string[] }> {
    const sesFA = this.sesiones(procIdx);
    const groups = new Map<string, { hora_inicio: string; hora_fin: string; fechas: string[] }>();
    for (const sg of sesFA.controls) {
      const fecha = sg.get('fecha')!.value as string;
      const hi = sg.get('hora_inicio')!.value as string;
      const hf = sg.get('hora_fin')!.value as string;
      if (!fecha || !hi || !hf) continue;
      const key = `${hi}-${hf}`;
      if (!groups.has(key)) groups.set(key, { hora_inicio: hi, hora_fin: hf, fechas: [] });
      groups.get(key)!.fechas.push(fecha);
    }
    return Array.from(groups.values()).map(g => ({ mode: 'list' as const, ...g }));
  }

  // ---------- Submit ----------
  async onSubmit() {
    try {
      this.serverErr.set(null);
      this.clearServerErrors();
      this.form.markAllAsTouched();

      // Validación proyecto: sum de procesos con horas debe == plan (si quieres exigir igualdad)
      const horasPlanificadas = Number(this.form.get('horas_planificadas')!.value || 0);
      const horasUsadas = this.totalAsignadas();
      if (Math.abs(horasUsadas - horasPlanificadas) > 1e-6) {
        this.serverErr.set(
          `La suma de horas de los procesos con registro por horas (${horasUsadas} h) debe ser igual a las horas planificadas del proyecto (${horasPlanificadas} h).`
        );
        return;
      }

      // Validaciones adicionales
      const perProcErr = this.validateProcesosHoursNotExceed();
      if (perProcErr) { this.serverErr.set(perProcErr); return; }

      const timeErr = this.validateSessionTimeRanges();
      if (timeErr) {
        this.serverErr.set('Corrige los errores de horario.');
        this.serverFieldErrors.set({ [this.pathKey(timeErr.path)]: [timeErr.message] });
        return;
      }

      const fechaErr = this.validateFechasDentroPeriodo();
      if (fechaErr) {
        this.serverErr.set('Hay fechas fuera del período del proyecto.');
        this.serverFieldErrors.set({ [this.pathKey(fechaErr.path)]: [fechaErr.message] });
        return;
      }

      this.submitting.set(true);

      // 1) Crear proyecto
      const payloadProyecto = {
        ep_sede_id: this.form.get('ep_sede_id')!.value!,
        periodo_id: this.form.get('periodo_id')!.value!,
        codigo: this.form.get('codigo')!.value || null,
        titulo: this.form.get('titulo')!.value!,
        descripcion: this.form.get('descripcion')!.value || null,
        tipo: this.form.get('tipo')!.value!,
        modalidad: this.form.get('modalidad')!.value!,
        nivel: this.form.get('tipo')!.value === 'VINCULADO' ? this.form.get('nivel')!.value : null,
        horas_planificadas: horasPlanificadas,
        horas_minimas_participante: null
      };

      const rProyecto = await firstValueFrom(this.api.crearProyecto(payloadProyecto));
      if (!hasData(rProyecto)) throw new Error('Error creando proyecto');
      const proyectoId = rProyecto.data.id;
      this.createdProyectoId = proyectoId;

      // 2) Crear procesos y sesiones (batch)
      for (let i = 0; i < this.procesosFA.length; i++) {
        const g = this.procesosFA.at(i);
        const tipo = g.get('tipo_registro')!.value!;
        const payloadProc: any = {
          nombre: g.get('nombre')!.value!,
          descripcion: g.get('descripcion')!.value || null,
          tipo_registro: tipo,
          requiere_asistencia: !!g.get('requiere_asistencia')!.value,
          orden: i + 1
        };
        // Condicionales según tu ProcesoStoreRequest
        const horas = g.get('horas_asignadas')!;
        if (horas.enabled) payloadProc.horas_asignadas = Number(horas.value || 0);
        const nota = g.get('nota_minima')!;
        if (nota.enabled) payloadProc.nota_minima = Number(nota.value || 0);

        const rProceso = await firstValueFrom(this.api.crearProceso(proyectoId, payloadProc));
        if (!hasData(rProceso)) throw new Error('Error creando proceso');
        const procesoId = rProceso.data.id;

        // Sesiones → agrupar por (hi,hf) y enviar batch
        const batches = this.buildBatchPayloads(i);
        for (const b of batches) {
          await firstValueFrom(this.api.crearSesionesBatch(procesoId, b));
        }
      }

      // 3) Subir imágenes
      for (const img of this.imagenes()) {
        try {
          await firstValueFrom(this.api.subirImagenProyecto(proyectoId, img.file));
        } catch (e) {
          console.warn('Error al subir imagen:', e);
        }
      }

      this.createdProyectoId = null;
      this.router.navigate(['/vm/proyectos', proyectoId]);
    } catch (error: any) {
      console.error(error);
      let msg = 'Error del servidor. Por favor, intenta más tarde.';
      if (error?.status === 422) {
        const parsed = this.extractServerValidation(error);
        msg = parsed.message || 'Datos inválidos. Revisa los campos.';
        this.serverFieldErrors.set(parsed.fields);
      } else if (error?.status === 403) {
        msg = 'No tienes permisos para esta operación.';
      } else if (error?.status === 401) {
        msg = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      } else if (error?.message?.includes('Network')) {
        msg = 'Error de conexión. Verifica tu internet.';
      }
      this.serverErr.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  // ---------- Cancelar / rollback ----------
  openCancel() {
    this.showCancel.set(true);
  }
  closeCancel() {
    this.showCancel.set(false);
  }

  async confirmCancel() {
    this.showCancel.set(false);
    if (!this.createdProyectoId) {
      this.router.navigate(['/vm/proyectos']);
      return;
    }
    try {
      this.rollingBack.set(true);
      await firstValueFrom(this.api.eliminarProyecto(this.createdProyectoId));
    } catch (e) {
      console.error('Error al anular proyecto parcial', e);
    } finally {
      this.rollingBack.set(false);
      this.router.navigate(['/vm/proyectos']);
    }
  }

  // ---------- Lookups ----------
  private async loadLookups() {
    try {
      const [eps, pers] = await Promise.all([
        firstValueFrom(this.lookups.fetchMyEpSedesStaff(50)),
        firstValueFrom(this.lookups.fetchPeriodos('', false, 50))
      ]);

      // Guardamos índice de periodos para validar fechas (si vienen en la respuesta)
      (pers as PeriodoItem[]).forEach((p: any) => {
        this.periodosIndex[p.id] = {
          inicio: p.fecha_inicio || undefined,
          fin: p.fecha_fin || undefined,
          codigo: p.codigo || `${p.anio} - ${p.ciclo}`
        };
      });

      this.epOptions.set(eps.map((o: any) => ({ value: o.id, label: o.label })));
      this.perOptions.set(
        (pers as PeriodoItem[]).map((p: any) => ({
          value: p.id,
          label: `${p.anio ?? ''} - ${p.ciclo ?? ''}`.trim().replace(/^ - | - $/g, '') || (p.codigo ?? p.id),
          estado: p.estado
        }))
      );

      // EP_SEDE por defecto: la primera disponible
      if (!this.form.get('ep_sede_id')!.value && eps.length) {
        this.form.get('ep_sede_id')!.setValue(eps[0].id);
      }

      // Período por defecto: EN_CURSO > PLANIFICADO > primero
      const current =
        (pers as any[]).find((p: any) => String(p.estado || '').toUpperCase() === 'EN_CURSO') ??
        (pers as any[]).find((p: any) => String(p.estado || '').toUpperCase() === 'PLANIFICADO') ??
        (pers as any[])[0];

      if (current && !this.form.get('periodo_id')!.value) {
        this.form.get('periodo_id')!.setValue(current.id);
      }

      // Si es VINCULADO, cargar niveles del combo por defecto
      if (this.form.get('tipo')!.value === 'VINCULADO' && this.form.get('ep_sede_id')!.value && this.form.get('periodo_id')!.value) {
        await this.loadNivelesDisponibles(this.form.get('ep_sede_id')!.value!, this.form.get('periodo_id')!.value!);
      }
    } catch {
      this.serverErr.set('No se pudieron cargar las opciones. Verifica tu conexión a internet.');
    }
  }

  private async loadNivelesDisponibles(epSedeId: number, periodoId: number) {
    try {
      const res = await firstValueFrom(
        this.api.nivelesDisponibles({ ep_sede_id: epSedeId, periodo_id: periodoId })
      );
      const arr = Array.isArray((res as any).data) ? (res as any).data : res;
      const clean = (arr as number[]).filter(
        (n) => typeof n === 'number' && n >= 1 && n <= 10
      );
      this.nivelesDisponibles.set(clean.length ? clean : []);
    } catch {
      this.nivelesDisponibles.set(Array.from({ length: 10 }, (_, i) => i + 1));
    }
  }
}
