import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { EvApiService } from '../../data-access/ev-api.service';
import {
  EventoCreate,
  Periodo,
  SesionCreate,
  VmCategoriaEvento,
  VmEvento,
} from '../../models/ev.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service';

type SesionForm = SesionCreate;

@Component({
  standalone: true,
  selector: 'ev-event-create-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './event-create.page.html',
})
export class EventCreatePage {
  private evApi = inject(EvApiService);
  private loader = inject(LoaderService);

  // Estado base
  loading           = signal<boolean>(false);
  loadingPeriodos   = signal<boolean>(false);
  loadingCategorias = signal<boolean>(false);
  error             = signal<string | null>(null);
  success           = signal<string | null>(null);

  // Lookups
  periodos  = signal<Periodo[]>([]);
  periodoId = signal<number | null>(null);

  categorias  = signal<VmCategoriaEvento[]>([]);
  categoriaId = signal<number | null>(null);

  // Datos del evento
  titulo           = signal<string>('');
  subtitulo        = signal<string>('');
  descripcionCorta = signal<string>('');
  descripcionLarga = signal<string>('');

  modalidad        = signal<'PRESENCIAL' | 'VIRTUAL' | 'MIXTA'>('PRESENCIAL');
  lugarDetallado   = signal<string>('');
  urlImagenPortada = signal<string>(''); // URL opcional
  urlEnlaceVirtual = signal<string>('');

  inscripcionDesde = signal<string>(''); // YYYY-MM-DD
  inscripcionHasta = signal<string>(''); // YYYY-MM-DD

  requiereInscripcion = signal<boolean>(false);
  cupoMaximo          = signal<number | null>(null);
  codigo              = signal<string>(''); // opcional

  // Imagen (archivo opcional)
  imagenPortadaFile = signal<File | null>(null);

  // Sesiones
  sesiones = signal<SesionForm[]>([
    { fecha: '', hora_inicio: '', hora_fin: '' },
  ]);

  // Botón habilitado
  canSubmit = computed(() => {
    // Sólo bloquear mientras guardamos
    if (this.loading()) return false;

    if (!this.periodoId() || !this.titulo().trim()) return false;

    const list = this.sesiones();
    if (!list.length) return false;

    const hasValid = list.some(
      (s) => !!s.fecha && !!s.hora_inicio && !!s.hora_fin
    );
    return hasValid;
  });

  constructor() {
    this.cargarPeriodos();
    this.cargarCategorias();
  }

  // ───────── Lookups: periodos ─────────
  cargarPeriodos(): void {
    this.loadingPeriodos.set(true);

    this.loader
      .track(
        this.evApi.fetchPeriodos('', true, 50),
        'Cargando períodos académicos...'
      )
      .subscribe({
        next: (arr: Periodo[]) => {
          this.periodos.set(arr);
          if (!this.periodoId() && arr.length) {
            this.periodoId.set(arr[0].id);
          }
        },
        error: (err) => {
          console.error('Error al cargar períodos', err);
          this.periodos.set([]);
          this.error.set('No se pudieron cargar los períodos académicos.');
          this.loadingPeriodos.set(false);
        },
        complete: () => {
          this.loadingPeriodos.set(false);
        },
      });
  }

  // ───────── Lookups: categorías ─────────
  cargarCategorias(): void {
    this.loadingCategorias.set(true);

    this.loader
      .track(
        this.evApi.listarCategoriasEvento(),
        'Cargando categorías de evento...'
      )
      .subscribe({
        next: (arr: VmCategoriaEvento[]) => {
          this.categorias.set(arr);
          if (!this.categoriaId() && arr.length) {
            this.categoriaId.set(arr[0].id);
          }
        },
        error: (err) => {
          console.error('Error al cargar categorías', err);
          this.categorias.set([]);
          this.error.set('No se pudieron cargar las categorías de evento.');
          this.loadingCategorias.set(false);
        },
        complete: () => {
          this.loadingCategorias.set(false);
        },
      });
  }

  // ───────── Sesiones (UI) ─────────
  addSesion(): void {
    const list = this.sesiones();
    this.sesiones.set([...list, { fecha: '', hora_inicio: '', hora_fin: '' }]);
  }

  removeSesion(index: number): void {
    const list = this.sesiones();
    if (list.length <= 1) return;
    this.sesiones.set(list.filter((_, i) => i !== index));
  }

  updateSesion(index: number, patch: Partial<SesionForm>): void {
    const list = this.sesiones();
    const current = list[index];
    if (!current) return;
    const updated = { ...current, ...patch };
    const copy = [...list];
    copy[index] = updated;
    this.sesiones.set(copy);
  }

  // ───────── Imagen portada (archivo) ─────────
  onImagenPortadaChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.imagenPortadaFile.set(file);
  }

  // ───────── Guardar evento ─────────
  submit(): void {
    this.error.set(null);
    this.success.set(null);

    if (!this.periodoId()) {
      this.error.set('Selecciona un período académico.');
      return;
    }

    if (!this.titulo().trim()) {
      this.error.set('Ingresa un título para el evento.');
      return;
    }

    const sesionesValidas = this.sesiones().filter(
      (s) => s.fecha && s.hora_inicio && s.hora_fin
    );

    if (!sesionesValidas.length) {
      this.error.set(
        'Debes registrar al menos una sesión con fecha y horas completas.'
      );
      return;
    }

    const payload: EventoCreate = {
      titulo: this.titulo().trim(),
      periodo_id: this.periodoId()!,

      categoria_evento_id: this.categoriaId() ?? undefined,

      codigo: this.codigo().trim() || undefined,
      subtitulo: this.subtitulo().trim() || undefined,
      descripcion_corta: this.descripcionCorta().trim() || undefined,
      descripcion_larga: this.descripcionLarga().trim() || undefined,

      modalidad: this.modalidad(),
      lugar_detallado: this.lugarDetallado().trim() || undefined,
      url_imagen_portada: this.urlImagenPortada().trim() || undefined,
      url_enlace_virtual: this.urlEnlaceVirtual().trim() || undefined,

      requiere_inscripcion: this.requiereInscripcion(),
      cupo_maximo: this.cupoMaximo() ?? null,

      inscripcion_desde: this.inscripcionDesde() || undefined,
      inscripcion_hasta: this.inscripcionHasta() || undefined,

      sesiones: sesionesValidas,
    };

    this.loading.set(true);

    this.loader
      .track(this.evApi.crearEvento(payload), 'Creando evento...')
      .subscribe({
        next: (res: VmEvento | any) => {
          const evt: VmEvento = res?.data ?? res;

          // si no se pudo obtener data
          if (!evt || !evt.id) {
            this.error.set('No se pudo registrar el evento.');
            this.loading.set(false);
            return;
          }

          const file = this.imagenPortadaFile();

          // Si no hay archivo, terminamos
          if (!file) {
            this.success.set(`Evento "${evt.titulo}" creado correctamente.`);
            this.resetForm(false);
            this.loading.set(false);
            return;
          }

          // Hay archivo -> subir imagen
          this.loader
            .track(
              this.evApi.subirImagenEvento(evt.id, file),
              'Subiendo imagen de portada...'
            )
            .subscribe({
              next: () => {
                this.success.set(
                  `Evento "${evt.titulo}" creado correctamente y se subió la imagen de portada.`
                );
                this.resetForm(false);
              },
              error: (err) => {
                console.error('Error al subir imagen', err);
                this.error.set(
                  'El evento se creó, pero hubo un problema subiendo la imagen de portada.'
                );
              },
              complete: () => {
                this.loading.set(false);
              },
            });
        },
        error: (err) => {
          console.error('Error al crear evento', err);
          this.error.set(
            err?.error?.message ||
              'No se pudo registrar el evento. Verifica los datos e inténtalo nuevamente.'
          );
          this.loading.set(false);
        },
      });
  }

  resetForm(clearPeriodo: boolean = false): void {
    if (clearPeriodo) {
      this.periodoId.set(null);
      this.categoriaId.set(null);
    }

    this.titulo.set('');
    this.subtitulo.set('');
    this.descripcionCorta.set('');
    this.descripcionLarga.set('');
    this.modalidad.set('PRESENCIAL');
    this.lugarDetallado.set('');
    this.urlImagenPortada.set('');
    this.urlEnlaceVirtual.set('');
    this.inscripcionDesde.set('');
    this.inscripcionHasta.set('');
    this.requiereInscripcion.set(false);
    this.cupoMaximo.set(null);
    this.codigo.set('');
    this.imagenPortadaFile.set(null);

    this.sesiones.set([{ fecha: '', hora_inicio: '', hora_fin: '' }]);
  }
}
