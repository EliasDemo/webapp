import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatriculaManualApiService } from '../../../data-access/m-manual.api';
import { RegistrarPayload, RegistrarResponse, ManualBuscarResponse, Id } from '../../../models/m-manual.models';

@Component({
  standalone: true,
  selector: 'm-manual-registrar-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './m-manual-registrar.page.html',
})
export class MManualRegistrarPage {
  private api = inject(MatriculaManualApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // ====== Estado ======
  form = signal<RegistrarPayload>({
    codigo_estudiante: null,
    grupo: null,
    correo_institucional: null,
    ciclo: null,
    estado: undefined,
    first_name: null,
    last_name: null,
    estudiante: null,
    documento: null,
    email: null,
    celular: null,
    pais: null,
    religion: null,
    fecha_nacimiento: null,
    ep_sede_id: null,
  });

  // Snapshot para saber si hay cambios (dirty)
  private original = signal<Partial<RegistrarPayload> | null>(null);
  // Expediente cargado (para poder ir a Matricular)
  loadedExpedienteId = signal<number | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);
  okMsg = signal<string | null>(null);
  choices: number[] | null = null; // EP‑SEDE sugeridas por backend (cuando sea obligatorio escoger)
  alumnoCard = signal<{ nombre?: string; codigo?: string; doc?: string } | null>(null);

  // Requeridos mínimos
  requiredMissing = computed<string[]>(() => {
    const f = this.form();
    const miss: string[] = [];
    if (!f.codigo_estudiante?.trim()) miss.push('Código');
    if (!f.first_name?.trim()) miss.push('Nombres');
    if (!f.last_name?.trim()) miss.push('Apellidos');
    if (!f.documento?.trim()) miss.push('Documento');
    return miss;
  });

  // Dirty check básico contra snapshot “original”
  private readonly FIELDS: (keyof RegistrarPayload)[] = [
    'codigo_estudiante','grupo','correo_institucional','ciclo','estado',
    'first_name','last_name','estudiante','documento','email','celular',
    'pais','religion','fecha_nacimiento','ep_sede_id'
  ];
  isDirty = computed(() => {
    const o = this.original();
    if (!o) return true; // si no hay snapshot, consideramos nuevo/dirty
    const f = this.form();
    return this.FIELDS.some(k => (f[k] ?? null) !== ((o as any)[k] ?? null));
  });

  constructor() {
    // Prefill desde query ?codigo=...
    const codigo = this.route.snapshot.queryParamMap.get('codigo');
    if (codigo) {
      this.patch({ codigo_estudiante: codigo });
      // Autocarga tras microtask para que el input inicial no dispare doble
      queueMicrotask(() => this.cargarPorCodigo());
    }
  }

  patch(partial: Partial<RegistrarPayload>) {
    this.form.update(v => ({ ...v, ...partial }));
  }

  // ====== Debounce para búsqueda por código ======
  private debounceTimer: any = null;
  onCodigoChanged(value: string) {
    this.patch({ codigo_estudiante: value || null });
    // Limpieza de estado al cambiar de alumno
    this.error.set(null);
    this.okMsg.set(null);
    this.loadedExpedienteId.set(null);
    this.alumnoCard.set(null);
    this.original.set(null);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const trimmed = (value || '').trim();
    if (trimmed.length >= 3) {
      this.debounceTimer = setTimeout(() => this.cargarPorCodigo(), 400);
    }
  }

  // ====== Cargar por código ======
  cargarPorCodigo(): void {
    const cod = (this.form().codigo_estudiante || '').trim();
    if (!cod) return;

    this.loading.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.choices = null;

    this.api.buscar({ codigo: cod }).subscribe({
      next: (res: ManualBuscarResponse) => {
        if (!res.ok) {
          this.error.set(res.message || 'No se encontró el expediente.');
          this.alumnoCard.set(null);
          this.original.set(null);
          this.loadedExpedienteId.set(null);
          return;
        }

        const u = res.data.user || {};
        const e = res.data.expediente || {};

        // Precargar usuario + expediente
        const patch: Partial<RegistrarPayload> = {
          grupo: e.grupo ?? null,
          correo_institucional: e.correo_institucional ?? null,
          ciclo: e.ciclo ?? null,
          estado: e.estado ?? undefined,
          first_name: u.first_name ?? null,
          last_name: u.last_name ?? null,
          estudiante: null, // si mandas 'estudiante' completo podrías dividir en backend
          documento: u.doc_numero ?? null,
          email: u.email ?? null,
          celular: u.celular ?? null,
          pais: u.pais ?? null,
          religion: u.religion ?? null,
          fecha_nacimiento: u.fecha_nacimiento ?? null,
          ep_sede_id: e.ep_sede_id ?? null,
        };
        this.patch(patch);

        // Snapshot para dirty check
        this.original.set({
          codigo_estudiante: cod,
          ...patch
        });

        this.loadedExpedienteId.set(e.id ?? null);
        this.alumnoCard.set({
          nombre: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          codigo: e.codigo_estudiante || cod,
          doc: u.doc_numero || '—',
        });
        this.okMsg.set('Datos precargados desde el expediente.');
      },
      error: (e: any) => this.error.set(e?.error?.message || 'Error de red.'),
      complete: () => this.loading.set(false),
    });
  }

  // ====== Guardar ======
  enviar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.okMsg.set(null);
    this.choices = null;

    // Normaliza strings: trim sencillo
    const clean = (s: string | null | undefined) => s == null ? null : (s.trim() || null);
    this.form.update(f => ({
      ...f,
      codigo_estudiante: clean(f.codigo_estudiante),
      first_name: clean(f.first_name),
      last_name: clean(f.last_name),
      estudiante: clean(f.estudiante),
      documento: clean(f.documento),
      email: clean(f.email),
      celular: clean(f.celular),
      pais: clean(f.pais),
      religion: clean(f.religion),
      fecha_nacimiento: clean(f.fecha_nacimiento),
      grupo: clean(f.grupo),
      correo_institucional: clean(f.correo_institucional),
      ciclo: clean(f.ciclo),
    }));

    this.api.registrarOActualizar(this.form()).subscribe({
      next: (res: RegistrarResponse) => {
        if (res.ok) {
          this.okMsg.set('Datos guardados correctamente.');
          // Snapshot nuevo para dirty
          this.original.set({ ...this.form() });
        } else {
          this.error.set(res.message || 'No se pudo guardar.');
          if (Array.isArray((res as any).choices)) this.choices = (res as any).choices as number[];
        }
      },
      error: (e: any) => this.error.set(e?.error?.message || 'Error de red.'),
      complete: () => this.loading.set(false),
    });
  }

  // ====== EP‑SEDE (chips) ======
  seleccionarEpSede(id: number): void {
    this.patch({ ep_sede_id: id as Id });
    this.okMsg.set(`EP‑SEDE seleccionada: ${id}. Guarda para aplicar.`);
    this.error.set(null);
  }

  // ====== Acciones ======
  irAMatricular(): void {
    const exp = this.loadedExpedienteId();
    const cod = this.form().codigo_estudiante || undefined;
    if (exp) {
      this.router.navigate(['/m/manual/matricular'], { queryParams: { expedienteId: exp, codigo: cod } });
    } else {
      this.router.navigate(['/m/manual/matricular'], { queryParams: { codigo: cod } });
    }
  }

  limpiarFormulario(): void {
    const codigo = this.form().codigo_estudiante || null; // si quieres preservar el código, deja esto
    this.form.set({
      codigo_estudiante: codigo,
      grupo: null,
      correo_institucional: null,
      ciclo: null,
      estado: undefined,
      first_name: null,
      last_name: null,
      estudiante: null,
      documento: null,
      email: null,
      celular: null,
      pais: null,
      religion: null,
      fecha_nacimiento: null,
      ep_sede_id: null,
    });
    this.alumnoCard.set(null);
    this.error.set(null);
    this.okMsg.set(null);
    this.choices = null;
    this.original.set(null);
    this.loadedExpedienteId.set(null);
  }
}
