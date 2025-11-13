import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { LookupsApiService } from '../../lookups/lookups.api';

/** Type guard: valida si una respuesta tiene 'data' */
function hasData<T>(res: any): res is { ok: true; data: T } {
  return res && typeof res === 'object' && 'data' in res && res.ok === true;
}

type ImgItem = { file: File; preview: string };

// tipos auxiliares período
type PeriodoItem = {
  id: number; codigo?: string; anio?: string|number; ciclo?: string|number;
  estado?: string; fecha_inicio?: string; fecha_fin?: string
};

const EVAL_MIN = 1;
const EVAL_MAX = 20;

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
  serverFieldErrors = signal<Record<string, string[]>>({});

  epOptions = signal<{ value: number; label: string }[]>([]);
  perOptions = signal<{ value: number; label: string; estado?: string }[]>([]);
  nivelesDisponibles = signal<number[]>([]);
  nivelesLoadWarning = signal<string | null>(null);
  nivelesBloqueadosSrv = signal<number[]>([]); // ocupados reportados por backend en submit

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
    /** Multi‑nivel en proyecto (sólo se usa si tipo=VINCULADO) */
    niveles: this.fb.control<number[]>([], []),
    horas_planificadas: this.fb.control<number>(5, [Validators.required, Validators.min(1)]),
    procesos: this.fb.array<FormGroup>([])
  });

  // ===== Getters / helpers de formulario
  get procesosFA(): FormArray<FormGroup> {
    return this.form.get('procesos') as FormArray<FormGroup>;
  }
  get nivelesCtrl(): FormControl<number[]> {
    return this.form.get('niveles') as FormControl<number[]>;
  }

  // 'tipo' como signal (sincronizado con el select)
  tipo = signal<'VINCULADO' | 'LIBRE'>('VINCULADO');
  procesos = computed(() => this.procesosFA.controls);

  hasError = (c: string) =>
    !!this.form.get(c)?.invalid && (this.form.get(c)?.touched || this.form.get(c)?.dirty);

  isNivelSelected = (n: number) => (this.nivelesCtrl.value ?? []).includes(n);
  toggleNivel(n: number, checked: boolean) {
    const set = new Set(this.nivelesCtrl.value ?? []);
    checked ? set.add(n) : set.delete(n);
    this.nivelesCtrl.setValue([...set].sort((a,b)=>a-b));
    this.nivelesCtrl.markAsDirty(); this.nivelesCtrl.markAsTouched();
  }
  selectAllNiveles() {
    this.nivelesCtrl.setValue([...this.nivelesDisponibles()]);
    this.nivelesCtrl.markAsDirty(); this.nivelesCtrl.markAsTouched();
  }
  clearNiveles() {
    this.nivelesCtrl.setValue([]);
    this.nivelesCtrl.markAsDirty(); this.nivelesCtrl.markAsTouched();
  }
  nivelesInvalid(): boolean {
    return this.tipo() === 'VINCULADO'
      && !this.nivelesCtrl.disabled
      && ((this.nivelesCtrl.value?.length ?? 0) === 0)
      && (this.nivelesCtrl.touched || this.nivelesCtrl.dirty);
  }

  // ======= Errores de servidor
  private pathKey(path: (string | number)[]): string {
    return path.map(p => typeof p === 'number' ? `[${p}]` : p).join('.');
  }
  getSvr(path: (string | number)[]) {
    const k = this.pathKey(path);
    const map = this.serverFieldErrors();
    const arr = map[k];
    return arr?.length ? arr[0] : null;
  }
  private clearServerErrors() { this.serverFieldErrors.set({}); }

  private extractServerValidation(err: any): { message: string; fields: Record<string, string[]> } {
    let message = 'Datos inválidos.';
    const fields: Record<string, string[]> = {};
    const body = err?.error ?? err;

    if (typeof body === 'string') message = body;
    if (body?.message) message = body.message;

    // Laravel/Symfony-like
    if (body?.errors && typeof body.errors === 'object') {
      for (const [k, v] of Object.entries(body.errors)) {
        const key = /^niveles(\.\d+)?$/i.test(k) ? 'niveles' : String(k);
        const arr = Array.isArray(v) ? (v as string[]) : [String(v)];
        (fields[key] ||= []).push(...arr.map(String));
      }
    }
    if (Array.isArray(body?.violations)) {
      for (const it of body.violations) {
        const key = /^niveles(\.\d+)?$/i.test(String(it.propertyPath)) ? 'niveles' : String(it.propertyPath || it.field || it.name || 'general');
        const msg = String(it.message || it.reason || 'Inválido');
        (fields[key] ||= []).push(msg);
      }
    }
    if (Array.isArray(body?.fieldErrors)) {
      for (const it of body.fieldErrors) {
        const key = /^niveles(\.\d+)?$/i.test(String(it.field)) ? 'niveles' : String(it.field || 'general');
        const msg = String(it.message || 'Inválido');
        (fields[key] ||= []).push(msg);
      }
    }
    if (Array.isArray(body?.fechas_fuera) && (body?.rango?.length === 2)) {
      message = body.message || 'Hay fechas fuera del período del proyecto.';
      (fields['fechas'] ||= []).push(`Fuera del periodo: ${body.rango[0]} a ${body.rango[1]}.`);
    }

    return { message, fields };
  }

  /** Extrae números de ciclos (1..10) de textos del servidor */
  private parseCiclosFromText(text: string): number[] {
    if (!text) return [];
    const nums = new Set<number>();
    const re = /\b(?:nivel|ciclo)\s*(\d{1,2})\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 10) nums.add(n);
    }
    return [...nums];
  }

  // === SANITIZADORES FRONT ===
  private sanitizeFecha(raw: string): string {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  private sanitizeHora(raw: string): string {
    if (!raw) return '';
    let s = String(raw).trim();
    const m1 = s.match(/^(\d{1}):(\d{2})$/);
    if (m1) s = `0${m1[1]}:${m1[2]}`;
    const m2 = s.match(/^(\d{2}):(\d{2}):\d{2}$/);
    if (m2) s = `${m2[1]}:${m2[2]}`;
    return /^\d{2}:\d{2}$/.test(s) ? s : '';
  }

  // ======= Utilidades de tiempo
  private hhmmToMinutes(hhmm: string): number | null {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  private minutesToHhmm(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  private diffMinutes(hi: string, hf: string): number {
    const mi = this.hhmmToMinutes(hi);
    const mf = this.hhmmToMinutes(hf);
    if (mi == null || mf == null) return 0;
    return Math.max(0, mf - mi);
  }

  // ======= Cálculos de horas (global)
  private isHoursDriven(idx: number): boolean {
    const t = (this.procesosFA.at(idx).get('tipo_registro')!.value || 'HORAS') as string;
    return t === 'HORAS' || t === 'MIXTO';
  }
  private isEval(idx: number): boolean {
    const t = (this.procesosFA.at(idx).get('tipo_registro')!.value || 'HORAS') as string;
    return t === 'EVALUACION';
  }

  hasEvaluationProcess(): boolean {
    return this.procesosFA.controls.some(g => g.get('tipo_registro')!.value === 'EVALUACION');
  }

  /** Tope global permitido (plan × #ciclos si hay 2+ en VINCULADO) */
  allowedPlanTotal(): number {
    const plan = Number(this.form.get('horas_planificadas')!.value || 0);
    if (this.tipo() === 'VINCULADO') {
      const n = this.nivelesCtrl.value?.length || 0;
      return plan * (n >= 2 ? n : 1);
    }
    return plan;
  }

  totalAsignadas(): number {
    return this.procesosFA.controls
      .map((g, i) => this.isHoursDriven(i) ? Number(g.get('horas_asignadas')!.value || 0) : 0)
      .reduce((a, b) => a + b, 0);
  }
  remainingProject(): number {
    return Math.max(0, this.allowedPlanTotal() - this.totalAsignadas());
  }
  getHorasAsignadas(idx: number): number {
    const g = this.procesosFA.at(idx);
    return this.isHoursDriven(idx) ? Number(g.get('horas_asignadas')!.value || 0) : 0;
  }
  usedMinutesProceso(idx: number): number {
    const sesFA = this.sesiones(idx);
    return sesFA.controls
      .map(sg => {
        const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
        const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
        return hi && hf ? this.diffMinutes(hi, hf) : 0;
      }).reduce((a, b) => a + b, 0);
  }
  usedHoursProceso(idx: number): number {
    return +(this.usedMinutesProceso(idx) / 60).toFixed(2);
  }
  remainingMinutesProceso(idx: number): number {
    if (!this.isHoursDriven(idx)) return Number.POSITIVE_INFINITY;
    const asignadas = this.getHorasAsignadas(idx) * 60;
    return Math.max(0, asignadas - this.usedMinutesProceso(idx));
  }

  // ======= Por ciclo (VINCULADO)
  planMin(): number { return Number(this.form.get('horas_planificadas')!.value || 0) * 60; }

  private usedMinutesByNivel(): Record<number, number> {
    const niveles = this.nivelesCtrl.value ?? [];
    const acc: Record<number, number> = {};
    niveles.forEach((n: number) => acc[n] = 0);

    for (let pi = 0; pi < this.procesosFA.length; pi++) {
      if (!this.isHoursDriven(pi)) continue;
      const sesFA = this.sesiones(pi);
      for (const sg of sesFA.controls) {
        const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
        const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
        const mins = hi && hf ? this.diffMinutes(hi, hf) : 0;
        const nivs: number[] = (sg.get('niveles')!.value || []);
        for (const n of nivs) {
          if (acc[n] != null) acc[n] += mins;
        }
      }
    }
    return acc;
  }

  perNivelUsadasHoras(n: number): number {
    const used = this.usedMinutesByNivel()[n] || 0;
    return +(used / 60).toFixed(2);
  }
  perNivelRestanteMin(n: number): number {
    const used = this.usedMinutesByNivel()[n] || 0;
    return Math.max(0, this.planMin() - used);
  }
  perNivelPct(n: number): number {
    const used = this.usedMinutesByNivel()[n] || 0;
    return Math.max(0, Math.min(100, (used / this.planMin()) * 100 || 0));
  }
  nivelBarClass(n: number): string {
    const rest = this.perNivelRestanteMin(n);
    if (rest <= 0) return 'bg-red-500';
    if (rest < this.planMin() * 0.2) return 'bg-amber-500';
    return 'bg-blue-600';
  }

  // ===== Cap directo al editar una sesión
  private enforceCapForSession(procIdx: number, sesIdx: number) {
    if (!this.isHoursDriven(procIdx)) return;
    const sesFA = this.sesiones(procIdx);
    const sg = sesFA.at(sesIdx);
    const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
    const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
    const mi = hi ? this.hhmmToMinutes(hi) : null;
    const mf = hf ? this.hhmmToMinutes(hf) : null;
    if (mi == null || mf == null || mf <= mi) return;

    let otros = 0;
    sesFA.controls.forEach((x, j) => {
      if (j === sesIdx) return;
      const hi2 = this.sanitizeHora(String(x.get('hora_inicio')!.value || ''));
      const hf2 = this.sanitizeHora(String(x.get('hora_fin')!.value || ''));
      const d = (hi2 && hf2) ? this.diffMinutes(hi2, hf2) : 0;
      otros += d;
    });
    const cap = Math.max(0, this.getHorasAsignadas(procIdx) * 60 - otros);
    const dur = mf - mi;
    if (dur > cap) {
      const nuevoMf = mi + cap;
      const newHf = this.minutesToHhmm(Math.min(nuevoMf, 23 * 60 + 59));
      sg.get('hora_fin')!.setValue(newHf, { emitEvent: false });
      const durCtrl = sg.get('duracion_horas') as FormControl<number>;
      const minsNow = this.diffMinutes(hi, newHf);
      durCtrl?.setValue(Math.max(0.5, +(minsNow / 60).toFixed(2)), { emitEvent: false });
    }
  }

  /** ÚNICA definición (evita 'Duplicate function implementation') */
  sesiones(procIdx: number): FormArray<FormGroup> {
    return this.procesosFA.at(procIdx).get('sesiones') as FormArray<FormGroup>;
  }

  // ===== Sesiones y niveles por sesión
  sessionDurationMin(procIdx: number, sesIdx: number): number {
    const sg = this.sesiones(procIdx).at(sesIdx);
    const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
    const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
    return hi && hf ? this.diffMinutes(hi, hf) : 0;
  }

  nivelesOpcionesParaSesion(procIdx: number, sesIdx: number): number[] {
    if (this.tipo() !== 'VINCULADO') return [];
    const all = this.nivelesCtrl.value ?? [];
    const sel: number[] = (this.sesiones(procIdx).at(sesIdx).get('niveles')!.value || []);
    const dur = this.sessionDurationMin(procIdx, sesIdx);
    const used = this.usedMinutesByNivel();
    const plan = this.planMin();

    return all.filter((n: number) => {
      const remaining = Math.max(0, plan - (used[n] || 0) + (sel.includes(n) ? dur : 0));
      return remaining > 0 || sel.includes(n);
    });
  }

  nivelChipClass(n: number, procIdx: number, sesIdx: number): Record<string, boolean> {
    if (this.tipo() !== 'VINCULADO') return {};
    const sel: number[] = (this.sesiones(procIdx).at(sesIdx).get('niveles')!.value || []);
    const dur = this.sessionDurationMin(procIdx, sesIdx);
    const used = this.usedMinutesByNivel();
    const plan = this.planMin();
    const remaining = Math.max(0, plan - (used[n] || 0) + (sel.includes(n) ? dur : 0));

    const ok = remaining >= dur;
    const warn = remaining > 0 && remaining < dur;
    const full = remaining <= 0;

    return {
      'bg-emerald-50 border-emerald-300 text-emerald-700': ok,
      'bg-amber-50 border-amber-300 text-amber-700': warn,
      'bg-red-50 border-red-300 text-red-700': full,
    };
  }

  nivelChipDisabled(n: number, procIdx: number, sesIdx: number): boolean {
    const ctrl = this.sesiones(procIdx).at(sesIdx).get('niveles') as FormControl<number[]>;
    const selected = (ctrl.value || []).includes(n);
    const dur = this.sessionDurationMin(procIdx, sesIdx);
    const used = this.usedMinutesByNivel();
    const plan = this.planMin();
    const remaining = Math.max(0, plan - (used[n] || 0) + (selected ? dur : 0));
    return !selected && !(remaining >= dur);
  }

  toggleNivelSesion(procIdx: number, sesIdx: number, nivel: number, checked: boolean) {
    if (this.nivelChipDisabled(nivel, procIdx, sesIdx)) return;
    const sesFA = this.sesiones(procIdx);
    const ctrl = sesFA.at(sesIdx).get('niveles') as FormControl<number[]>;
    const set = new Set<number>(ctrl.value || []);
    checked ? set.add(nivel) : set.delete(nivel);
    ctrl.setValue([...set].sort((a, b) => a - b));
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  canAddProceso(): boolean { return !this.hasEvaluationProcess(); }
  canAddSesion(procIdx: number): boolean {
    if (this.isEval(procIdx)) return this.sesiones(procIdx).length < 1;
    return this.remainingMinutesProceso(procIdx) > 0;
  }

  // ======= Ciclo de vida
  async ngOnInit(): Promise<void> {
    await this.loadLookups();
    this.addProceso(true);

    this.tipo.set((this.form.get('tipo')!.value as 'VINCULADO' | 'LIBRE') ?? 'VINCULADO');

    this.subscriptions.push(
      this.form.get('tipo')!.valueChanges.subscribe(async (t) => {
        this.tipo.set((t as 'VINCULADO' | 'LIBRE') ?? 'VINCULADO');
        this.nivelesBloqueadosSrv.set([]);

        if (t === 'LIBRE') {
          this.nivelesCtrl.setValue([]);
          this.nivelesCtrl.disable({ emitEvent: false });
          const map = { ...this.serverFieldErrors() };
          delete map['niveles'];
          this.serverFieldErrors.set(map);
        } else {
          this.nivelesCtrl.enable({ emitEvent: false });
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
    this.imagenes().forEach((img) => URL.revokeObjectURL(img.preview));
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

  removeImage(idx: number) {
    const item = this.imagenes()[idx];
    if (item) URL.revokeObjectURL(item.preview);
    this.imagenes.set(this.imagenes().filter((_, i) => i !== idx));
  }

  // ---------- Paso 1 → Paso 2 ----------
  async goNext() {
    this.serverErr.set(null);
    this.clearServerErrors();
    this.form.markAllAsTouched();

    const controls = ['ep_sede_id', 'periodo_id', 'titulo', 'horas_planificadas'];
    if (this.tipo() === 'VINCULADO') {
      if (!this.nivelesCtrl.value?.length) {
        this.nivelesCtrl.markAsTouched();
        return;
      }
    }
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
      horas_asignadas: this.fb.control<number | null>(1, [Validators.min(1)]),
      tipo_registro: this.fb.control<'HORAS' | 'ASISTENCIA' | 'EVALUACION' | 'MIXTO'>('HORAS', [Validators.required]),
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
    const reqAsisCtrl = g.get('requiere_asistencia')!;

    const applyTipoRules = () => {
      const t = tipoCtrl.value! as 'HORAS' | 'ASISTENCIA' | 'EVALUACION' | 'MIXTO';
      const horasPlan = Number(this.form.get('horas_planificadas')!.value || 0);

      if (t === 'HORAS' || t === 'MIXTO') {
        horasCtrl.enable({ emitEvent: false });
        horasCtrl.setValidators([Validators.required, Validators.min(1)]);
      } else {
        horasCtrl.setValue(t === 'EVALUACION' ? horasPlan : null, { emitEvent: false });
        horasCtrl.clearValidators();
        horasCtrl.disable({ emitEvent: false });
      }
      horasCtrl.updateValueAndValidity({ emitEvent: false });

      if (t === 'EVALUACION' || t === 'MIXTO') {
        notaCtrl.enable({ emitEvent: false });
        notaCtrl.setValidators([Validators.required, Validators.min(EVAL_MIN), Validators.max(EVAL_MAX)]);
      } else {
        notaCtrl.setValue(null, { emitEvent: false });
        notaCtrl.clearValidators();
        notaCtrl.disable({ emitEvent: false });
      }
      notaCtrl.updateValueAndValidity({ emitEvent: false });

      if (t === 'ASISTENCIA' || t === 'MIXTO') {
        reqAsisCtrl.setValue(true, { emitEvent: false });
        reqAsisCtrl.disable({ emitEvent: false });
      } else {
        reqAsisCtrl.setValue(false, { emitEvent: false });
        reqAsisCtrl.disable({ emitEvent: false });
      }

      if (t === 'EVALUACION') {
        const sesFA = this.sesiones(idx);
        if (sesFA.length === 0) this.addSesion(idx);
        while (sesFA.length > 1) sesFA.removeAt(sesFA.length - 1);
      }
    };
    applyTipoRules();

    const subTipo = tipoCtrl.valueChanges.subscribe(() => applyTipoRules());
    this.subscriptions.push(subTipo);

    // Recorte si baja horas_asignadas
    const subHoras = horasCtrl.valueChanges.subscribe(() => {
      if (!this.isHoursDriven(idx)) return;
      let rest = this.remainingMinutesProceso(idx);
      if (rest >= 0) return;
      const sesFA = this.sesiones(idx);
      let exceso = -rest;
      for (let si = sesFA.length - 1; si >= 0 && exceso > 0; si--) {
        const sg = sesFA.at(si);
        const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
        const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
        const d = (hi && hf) ? this.diffMinutes(hi, hf) : 0;
        if (d <= exceso) {
          exceso -= d;
          sesFA.removeAt(si);
        } else {
          const mi = hi ? this.hhmmToMinutes(hi) ?? 0 : 0;
          const nuevoMf = mi + (d - exceso);
          sg.get('hora_fin')!.setValue(this.minutesToHhmm(nuevoMf), { emitEvent: false });
          const durCtrl = sg.get('duracion_horas') as FormControl<number>;
          durCtrl?.setValue(Math.max(0.5, +(((d - exceso)/60)).toFixed(2)), { emitEvent: false });
          exceso = 0;
        }
      }
    });
    this.subscriptions.push(subHoras);
  }

  removeProceso(index: number) {
    this.procesosFA.removeAt(index);
  }

  addSesion(procIdx: number) {
    if (!this.canAddSesion(procIdx)) return;

    const fa = this.sesiones(procIdx);

    const hi0 = '08:00';
    const remMin = this.remainingMinutesProceso(procIdx);
    const durMin = this.isHoursDriven(procIdx) ? Math.max(30, Math.min(60, remMin || 60)) : 60;
    const hf0 = this.minutesToHhmm((this.hhmmToMinutes(hi0) ?? 480) + durMin);

    const sg = this.fb.group({
      fecha: this.fb.control<string>('', [Validators.required]),
      hora_inicio: this.fb.control<string>(hi0, [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]),
      hora_fin: this.fb.control<string>(hf0,  [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]),
      duracion_horas: this.fb.control<number>(+(durMin / 60).toFixed(2), [Validators.required, Validators.min(0.5)]) ,
      niveles: this.fb.control<number[]>([], [])
    });

    // Preselecciona niveles con capacidad (VINCULADO)
    if (this.tipo() === 'VINCULADO') {
      const used = this.usedMinutesByNivel();
      const plan = this.planMin();
      const elegibles = (this.nivelesCtrl.value ?? []).filter((n: number) => (plan - (used[n] || 0)) >= durMin);
      sg.get('niveles')!.setValue(elegibles);
    }

    const hiCtrl = sg.get('hora_inicio') as FormControl<string>;
    const hfCtrl = sg.get('hora_fin') as FormControl<string>;
    const durCtrl = sg.get('duracion_horas') as FormControl<number>;
    let updating = false;

    const updateDurFromTimes = () => {
      if (updating) return;
      const hi = this.sanitizeHora(String(hiCtrl.value || ''));
      const hf = this.sanitizeHora(String(hfCtrl.value || ''));
      const mins = hi && hf ? this.diffMinutes(hi, hf) : 0;
      if (mins > 0) {
        updating = true;
        durCtrl.setValue(+(mins / 60).toFixed(2), { emitEvent: false });
        updating = false;
      }
    };
    const updateHfFromDur = () => {
      if (updating) return;
      const hi = this.sanitizeHora(String(hiCtrl.value || ''));
      const mi = hi ? this.hhmmToMinutes(hi) ?? 0 : 0;
      let mins = Math.max(30, Math.round(((durCtrl.value || 0.5) * 60) / 30) * 30);
      let mf = Math.min(mi + mins, 23 * 60 + 59);
      updating = true;
      hfCtrl.setValue(this.minutesToHhmm(mf), { emitEvent: false });
      this.enforceCapForSession(procIdx, fa.controls.indexOf(sg));
      updateDurFromTimes();
      updating = false;
    };

    this.subscriptions.push(hiCtrl.valueChanges.subscribe(() => updateHfFromDur()));
    this.subscriptions.push(hfCtrl.valueChanges.subscribe(() => {
      if (updating) return;
      updateDurFromTimes();
      this.enforceCapForSession(procIdx, fa.controls.indexOf(sg));
      updateDurFromTimes();
    }));
    this.subscriptions.push(durCtrl.valueChanges.subscribe(() => updateHfFromDur()));

    fa.push(sg);
  }

  removeSesion(procIdx: number, sesIdx: number) {
    this.sesiones(procIdx).removeAt(sesIdx);
  }

  // ======= Validaciones previas al submit
  private validateEvalRules(): string | null {
    const evalIdx = this.procesosFA.controls.findIndex(g => g.get('tipo_registro')!.value === 'EVALUACION');
    if (evalIdx >= 0) {
      if (this.procesosFA.length > 1) return 'Para procesos de EVALUACIÓN sólo se permite 1 proceso en el proyecto.';
      const sesFA = this.sesiones(evalIdx);
      if (sesFA.length !== 1) return 'El proceso de EVALUACIÓN debe tener exactamente 1 sesión.';
      const hp = Number(this.form.get('horas_planificadas')!.value || 0);
      const ha = Number(this.procesosFA.at(evalIdx).get('horas_asignadas')!.value || 0);
      if (ha !== hp) return 'En EVALUACIÓN las horas asignadas se igualan a las horas planificadas del proyecto.';
      const nota = Number(this.procesosFA.at(evalIdx).get('nota_minima')!.value || 0);
      if (!(nota >= EVAL_MIN && nota <= EVAL_MAX)) return `La nota mínima en EVALUACIÓN debe estar entre ${EVAL_MIN} y ${EVAL_MAX}.`;
    }
    return null;
  }

  private validateProcesosCapPorHoras(): string | null {
    for (let i = 0; i < this.procesosFA.length; i++) {
      if (!this.isHoursDriven(i)) continue;
      const asignadasMin = this.getHorasAsignadas(i) * 60;
      const usadasMin = this.usedMinutesProceso(i);
      if (usadasMin > asignadasMin) {
        return `En "${this.procesosFA.at(i).get('nombre')!.value}": las horas de las sesiones (${(usadasMin/60).toFixed(2)} h) exceden las asignadas (${this.getHorasAsignadas(i)} h).`;
      }
      if (usadasMin === 0) {
        return `En "${this.procesosFA.at(i).get('nombre')!.value}": agrega al menos una sesión con rango horario válido.`;
      }
    }
    return null;
  }

  private validateSessionTimeRanges(): { path: (string|number)[], message: string } | null {
    for (let pi = 0; pi < this.procesosFA.length; pi++) {
      const sesFA = this.sesiones(pi);
      for (let si = 0; si < sesFA.length; si++) {
        const sg = sesFA.at(si);
        const hi = this.sanitizeHora(String(sg.get('hora_inicio')!.value || ''));
        const hf = this.sanitizeHora(String(sg.get('hora_fin')!.value || ''));
        if (!hi || !hf) continue;
        const mi = this.hhmmToMinutes(hi);
        const mf = this.hhmmToMinutes(hf);
        if (mi == null || mf == null || mf <= mi) {
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
    if (!rango.inicio || !rango.fin) return null;

    for (let pi = 0; pi < this.procesosFA.length; pi++) { // <-- pi++
      const sesFA = this.sesiones(pi);
      for (let si = 0; si < sesFA.length; si++) {
        const f = this.sanitizeFecha(String(sesFA.at(si).get('fecha')!.value || ''));
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

  private validatePerNivelIgualPlan(): string[] | null {
    if (this.tipo() !== 'VINCULADO') return null;
    const niveles = this.nivelesCtrl.value ?? [];
    if (!niveles.length) return null;

    const objetivoMin = this.planMin();
    const used = this.usedMinutesByNivel();

    const errores: string[] = [];
    for (const n of niveles) {
      const usado = used[n] || 0;
      if (usado !== objetivoMin) {
        if (usado < objetivoMin) {
          errores.push(`Ciclo ${n}: faltan ${((objetivoMin - usado)/60).toFixed(2)} h para alcanzar ${objetivoMin/60} h.`);
        } else {
          errores.push(`Ciclo ${n}: excede por ${((usado - objetivoMin)/60).toFixed(2)} h el objetivo de ${objetivoMin/60} h.`);
        }
      }
    }
    return errores.length ? errores : null;
  }

  private validateAsignadasVsPlan(): string | null {
    if (this.hasEvaluationProcess()) return null;
    const totalAsign = this.totalAsignadas();
    const plan = Number(this.form.get('horas_planificadas')!.value || 0);
    const n = (this.tipo() === 'VINCULADO') ? (this.nivelesCtrl.value?.length || 0) : 0;
    const allowed = this.allowedPlanTotal();

    if (n >= 2 && this.tipo() === 'VINCULADO') {
      if (totalAsign > allowed + 1e-6) {
        return `Las horas asignadas (${totalAsign} h) exceden el tope global (${allowed} h = ${plan} h × ${n} ciclo(s)). Reduce o redistribuye.`;
      }
      return null;
    }
    if (Math.abs(totalAsign - plan) > 1e-6) {
      return `La suma de horas asignadas (${totalAsign} h) debe ser igual a las horas planificadas del proyecto (${plan} h).`;
    }
    return null;
  }

  // Agrupa para /sesiones/batch; sólo manda niveles si VINCULADO
  private buildBatchPayloads(procIdx: number):
    Array<{ mode: 'list'; hora_inicio: string; hora_fin: string; fechas: string[]; niveles?: number[] }> {

    const sesFA = this.sesiones(procIdx);
    type G = { hora_inicio: string; hora_fin: string; fechas: string[]; niveles?: number[] };
    const groups = new Map<string, G>();
    const esVinculado = this.tipo() === 'VINCULADO';

    const normKey = (hi: string, hf: string, niveles: number[]) =>
      `${hi}-${hf}-[${[...niveles].sort((a,b)=>a-b).join(',')}]`;

    for (const sg of sesFA.controls) {
      const fechaRaw = sg.get('fecha')!.value as string;
      const hiRaw    = sg.get('hora_inicio')!.value as string;
      const hfRaw    = sg.get('hora_fin')!.value as string;
      const nivs: number[] = (sg.get('niveles')!.value as number[]) || [];

      const fecha = this.sanitizeFecha(fechaRaw);
      const hi = this.sanitizeHora(hiRaw);
      const hf = this.sanitizeHora(hfRaw);

      if (!fecha || !hi || !hf) continue;

      const key = normKey(hi, hf, esVinculado ? nivs : []);
      if (!groups.has(key)) {
        groups.set(key, {
          hora_inicio: hi, // 👈 HH:mm (el backend lo normaliza a HH:mm:ss)
          hora_fin: hf,    // 👈 HH:mm
          fechas: [],
          niveles: (esVinculado && nivs.length) ? [...nivs] : undefined
        });
      }
      groups.get(key)!.fechas.push(fecha); // 👈 YYYY-MM-DD
    }
    return Array.from(groups.values()).map(g => ({ mode: 'list' as const, ...g }));
  }

  // ---------- Submit ----------
  async onSubmit() {
    try {
      this.serverErr.set(null);
      this.clearServerErrors();
      this.nivelesBloqueadosSrv.set([]);
      this.form.markAllAsTouched();

      const evalError = this.validateEvalRules();
      if (evalError) { this.serverErr.set(evalError); return; }

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

      const capErr = this.validateProcesosCapPorHoras();
      if (capErr) { this.serverErr.set(capErr); return; }

      const perNivelErrs = this.validatePerNivelIgualPlan();
      if (perNivelErrs?.length) { this.serverErr.set(perNivelErrs.join(' · ')); return; }

      const asignadasErr = this.validateAsignadasVsPlan();
      if (asignadasErr) { this.serverErr.set(asignadasErr); return; }

      this.submitting.set(true);

      // 1) Crear proyecto (sin niveles si LIBRE)
      const horasPlan = Number(this.form.get('horas_planificadas')!.value || 0);
      const payloadProyecto: any = {
        ep_sede_id: this.form.get('ep_sede_id')!.value!,
        periodo_id: this.form.get('periodo_id')!.value!,
        codigo: this.form.get('codigo')!.value || null,
        titulo: this.form.get('titulo')!.value!,
        descripcion: this.form.get('descripcion')!.value || null,
        tipo: this.form.get('tipo')!.value!,
        modalidad: this.form.get('modalidad')!.value!,
        horas_planificadas: horasPlan,
        horas_minimas_participante: null
      };
      if (this.tipo() === 'VINCULADO') {
        payloadProyecto.niveles = this.nivelesCtrl.value ?? [];
      }

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
        const horas = g.get('horas_asignadas')!;
        if (horas.enabled && (tipo === 'HORAS' || tipo === 'MIXTO')) payloadProc.horas_asignadas = Number(horas.value || 0);
        const nota = g.get('nota_minima')!;
        if (nota.enabled && (tipo === 'EVALUACION' || tipo === 'MIXTO')) payloadProc.nota_minima = Number(nota.value || 0);

        const rProceso = await firstValueFrom(this.api.crearProceso(proyectoId, payloadProc));
        if (!hasData(rProceso)) throw new Error('Error creando proceso');
        const procesoId = rProceso.data.id;

        const batches = this.buildBatchPayloads(i);

        // Validación defensiva previa al POST
        for (const b of batches) {
          const okHoras = /^\d{2}:\d{2}$/.test(b.hora_inicio) && /^\d{2}:\d{2}$/.test(b.hora_fin);
          const okFechas = b.fechas && b.fechas.length > 0 && b.fechas.every(f => /^\d{4}-\d{2}-\d{2}$/.test(f));
          if (!okHoras) {
            this.serverErr.set('Formato de hora inválido. Usa HH:mm.');
            this.submitting.set(false);
            return;
          }
          if (!okFechas) {
            this.serverErr.set('Una o más fechas tienen formato inválido. Usa AAAA-MM-DD.');
            this.submitting.set(false);
            return;
          }
        }

        for (const b of batches) {
          await firstValueFrom(this.api.crearSesionesBatch(procesoId, b));
        }
      }

      // 3) Subir imágenes (best‑effort)
      for (const img of this.imagenes()) {
        try { await firstValueFrom(this.api.subirImagenProyecto(proyectoId, img.file)); } catch {}
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

        // Detecta ciclos ocupados y actualiza disponibilidad + regresa a Paso 1
        const texts: string[] = [parsed.message, ...(parsed.fields['niveles'] || [])].filter(Boolean) as string[];
        const ocupados = new Set<number>();
        texts.forEach(t => this.parseCiclosFromText(t).forEach((n: number) => ocupados.add(n)));
        if (ocupados.size) {
          this.nivelesBloqueadosSrv.set([...ocupados]);
          const ep = this.form.get('ep_sede_id')!.value!;
          const per = this.form.get('periodo_id')!.value!;
          try { await this.loadNivelesDisponibles(ep, per); } catch {}
          this.step.set(1);
        }
      } else if (error?.status === 403) {
        msg = 'No tienes permisos para esta operación.';
      } else if (error?.status === 401) {
        msg = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      } else if (error?.status === 500) {
        const m = String(error?.error?.message || error?.message || '');
        if (/InvalidFormat|Double time specification|Carbon/i.test(m)) {
          msg = 'Formato de fecha/hora inválido en el servidor. Verifica usar fecha AAAA-MM-DD y hora HH:mm.';
        } else {
          msg = 'Error interno del servidor. Verifica horas/fechas.';
        }
      } else if (error?.message?.includes('Network')) {
        msg = 'Error de conexión. Verifica tu internet.';
      }

      // 🔁 Rollback automático si el proyecto ya existía
      if (this.createdProyectoId) {
        try {
          await firstValueFrom(this.api.eliminarProyecto(this.createdProyectoId));
          msg += ' Se anuló el proyecto parcial.';
        } catch {
          msg += ' No se pudo anular automáticamente el proyecto parcial.';
        } finally {
          this.createdProyectoId = null;
        }
      }

      this.serverErr.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  // ---------- Cancelar / rollback ----------
  openCancel() { this.showCancel.set(true); }
  closeCancel() { this.showCancel.set(false); }

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

      if (!this.form.get('ep_sede_id')!.value && eps.length) {
        this.form.get('ep_sede_id')!.setValue(eps[0].id);
      }

      const current =
        (pers as any[]).find((p: any) => String(p.estado || '').toUpperCase() === 'EN_CURSO') ??
        (pers as any[]).find((p: any) => String(p.estado || '').toUpperCase() === 'PLANIFICADO') ??
        (pers as any[])[0];

      if (current && !this.form.get('periodo_id')!.value) {
        this.form.get('periodo_id')!.setValue(current.id);
      }

      if (this.form.get('tipo')!.value === 'VINCULADO' && this.form.get('ep_sede_id')!.value && this.form.get('periodo_id')!.value) {
        await this.loadNivelesDisponibles(this.form.get('ep_sede_id')!.value!, this.form.get('periodo_id')!.value!);
      }
    } catch {
      this.serverErr.set('No se pudieron cargar las opciones. Verifica tu conexión a internet.');
    }
  }

  private async loadNivelesDisponibles(epSedeId: number, periodoId: number) {
    try {
      this.nivelesLoadWarning.set(null);
      this.nivelesBloqueadosSrv.set([]);

      const res = await firstValueFrom(
        this.api.nivelesDisponibles({ ep_sede_id: epSedeId, periodo_id: periodoId })
      );
      const arr = Array.isArray((res as any).data) ? (res as any).data : res;
      const clean = (arr as number[]).filter(
        (n) => typeof n === 'number' && n >= 1 && n <= 10
      );

      const selected = new Set(this.nivelesCtrl.value ?? []);
      const allowed = new Set(clean);
      const pruned = [...selected].filter((n: number) => allowed.has(n));

      this.nivelesDisponibles.set(clean);
      this.nivelesCtrl.setValue(pruned);
    } catch {
      // Fallback seguro: NO inventar 1..10; evita habilitar ciclos ocupados y terminar en 422
      this.nivelesDisponibles.set([]);
      this.nivelesCtrl.setValue([]);
      this.nivelesLoadWarning.set('No se pudo obtener la disponibilidad de ciclos para la sede/período seleccionados.');
    }
  }
}
