// src/app/features/events/pages/event-detail/event-detail.page.ts
import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EvApiService } from '../../data-access/ev-api.service';
import {
  VmEvento,
  VmImagen,
  VmCategoriaEvento,
} from '../../models/ev.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service';

@Component({
  standalone: true,
  selector: 'app-event-detail-page',
  templateUrl: './event-detail.page.html',
  imports: [CommonModule, FormsModule, RouterLink],
})
export class EventDetailPage implements OnInit {
  private api = inject(EvApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private loader = inject(LoaderService);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  evento = signal<VmEvento | null>(null);

  // Campos editables
  titulo = '';
  subtitulo = '';
  descripcionCorta = '';
  descripcionLarga = '';
  modalidad: 'PRESENCIAL' | 'VIRTUAL' | 'MIXTA' = 'PRESENCIAL';
  lugarDetallado = '';
  urlEnlaceVirtual = '';
  requiereInscripcion = false;
  cupoMaximo: number | null = null;
  inscripcionDesde = '';
  inscripcionHasta = '';
  categoriaId: number | null = null;

  // Categorías
  categorias = signal<VmCategoriaEvento[]>([]);
  loadingCategorias = signal(false);

  // Imágenes
  imagenes = signal<VmImagen[]>([]);
  imgLoading = signal(false);
  imgError = signal<string | null>(null);

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw ? Number(raw) : NaN;

    if (!Number.isFinite(id) || id <= 0) {
      this.errorMsg.set('ID de evento inválido.');
      return;
    }

    this.cargarCategorias();
    this.loadEvento(id);
  }

  private applyEvento(ev: VmEvento): void {
    this.evento.set(ev);

    this.titulo = ev.titulo || '';
    this.subtitulo = ev.subtitulo || '';
    this.descripcionCorta = ev.descripcion_corta || '';
    this.descripcionLarga = ev.descripcion_larga || '';
    this.modalidad = ev.modalidad || 'PRESENCIAL';
    this.lugarDetallado = ev.lugar_detallado || '';
    this.urlEnlaceVirtual = ev.url_enlace_virtual || '';
    this.requiereInscripcion = !!ev.requiere_inscripcion;
    this.cupoMaximo = ev.cupo_maximo ?? null;
    this.inscripcionDesde = ev.inscripcion_desde || '';
    this.inscripcionHasta = ev.inscripcion_hasta || '';
    this.categoriaId = ev.categoria_evento_id ?? null;
  }

  private loadEvento(id: number): void {
    this.loading.set(true);
    this.loader
      .track(this.api.obtenerEvento(id), 'Cargando evento...')
      .subscribe({
        next: (res) => {
          const ev = res.data;
          this.applyEvento(ev);
          this.loadImagenes(ev.id);
        },
        error: (err) => {
          console.error(err);
          this.errorMsg.set(
            err?.error?.message || 'No se pudo cargar el evento.'
          );
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  private cargarCategorias(): void {
    this.loadingCategorias.set(true);
    this.api.listarCategoriasEvento().subscribe({
      next: (cats) => {
        this.categorias.set(cats);
        this.loadingCategorias.set(false);
      },
      error: () => {
        this.categorias.set([]);
        this.loadingCategorias.set(false);
      },
    });
  }

  private loadImagenes(eventoId: number): void {
    this.imgLoading.set(true);
    this.api.listarImagenesEvento(eventoId).subscribe({
      next: (res) => {
        this.imagenes.set(res.data ?? []);
      },
      error: (err) => {
        console.error(err);
        this.imgError.set(
          err?.error?.message ||
            'No se pudieron cargar las imágenes del evento.'
        );
        this.imagenes.set([]);
        this.imgLoading.set(false);
      },
      complete: () => this.imgLoading.set(false),
    });
  }

  isEditable(ev: VmEvento): boolean {
    return ev.estado !== 'CERRADO' && ev.estado !== 'CANCELADO';
  }

  onSubmit(): void {
    const ev = this.evento();
    if (!ev) return;

    this.errorMsg.set(null);
    this.successMsg.set(null);

    if (!this.titulo.trim()) {
      this.errorMsg.set('Ingresa un título.');
      return;
    }

    if (!this.isEditable(ev)) {
      this.errorMsg.set(
        'No se pueden modificar eventos cerrados o cancelados.'
      );
      return;
    }

    const payload: Partial<VmEvento> = {
      titulo: this.titulo.trim(),
      subtitulo: this.subtitulo.trim() || null,
      descripcion_corta: this.descripcionCorta.trim() || null,
      descripcion_larga: this.descripcionLarga.trim() || null,
      modalidad: this.modalidad,
      lugar_detallado: this.lugarDetallado.trim() || null,
      url_enlace_virtual: this.urlEnlaceVirtual.trim() || null,
      requiere_inscripcion: this.requiereInscripcion,
      cupo_maximo:
        this.cupoMaximo !== null && this.cupoMaximo !== undefined
          ? Number(this.cupoMaximo)
          : null,
      inscripcion_desde: this.inscripcionDesde || null,
      inscripcion_hasta: this.inscripcionHasta || null,
      categoria_evento_id: this.categoriaId,
    };

    this.saving.set(true);

    this.loader
      .track(this.api.actualizarEvento(ev.id, payload), 'Actualizando evento...')
      .subscribe({
        next: (res) => {
          const updated = res.data;
          this.applyEvento(updated);
          this.successMsg.set('Evento actualizado correctamente.');
        },
        error: (err) => {
          console.error(err);
          this.errorMsg.set(
            err?.error?.message || 'No se pudo actualizar el evento.'
          );
          this.saving.set(false);
        },
        complete: () => this.saving.set(false),
      });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  onFileSelected(event: Event): void {
    const ev = this.evento();
    if (!ev) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imgError.set(null);
    this.imgLoading.set(true);

    this.loader
      .track(
        this.api.subirImagenEvento(ev.id, file),
        'Subiendo imagen del evento...'
      )
      .subscribe({
        next: () => {
          this.loadImagenes(ev.id);
          input.value = '';
        },
        error: (err) => {
          console.error(err);
          this.imgError.set(
            err?.error?.message || 'No se pudo subir la imagen.'
          );
          this.imgLoading.set(false);
        },
      });
  }

  eliminarImagen(imgId: number): void {
    const ev = this.evento();
    if (!ev) return;

    if (!confirm('¿Eliminar esta imagen del evento?')) return;

    this.imgError.set(null);

    this.loader
      .track(
        this.api.eliminarImagenEvento(ev.id, imgId),
        'Eliminando imagen...'
      )
      .subscribe({
        next: () => this.loadImagenes(ev.id),
        error: (err) => {
          console.error(err);
          this.imgError.set(
            err?.error?.message ||
              'No se pudo eliminar la imagen.'
          );
        },
      });
  }

  trackImg = (_: number, img: VmImagen) => img.id;

  // <- IMPORTANTE: tipo string para evitar tener que castear en el template
  prettyEstado(estado: string): string {
    switch (estado) {
      case 'PLANIFICADO':
        return 'Planificado';
      case 'EN_CURSO':
        return 'En curso';
      case 'CERRADO':
        return 'Cerrado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return estado;
    }
  }

  prettyTargetType(t: VmEvento['targetable_type']): string {
    switch (t) {
      case 'ep_sede':
        return 'EP-Sede';
      case 'sede':
        return 'Sede';
      case 'facultad':
        return 'Facultad';
      default:
        return t;
    }
  }
}
