import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VmProyecto } from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-card',
  imports: [CommonModule, RouterLink],
  templateUrl: './proyecto-card.component.html',
  styleUrls: ['./proyecto-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoCardComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() proyecto!: VmProyecto;
  @Output() delete = new EventEmitter<number>();

  /** refs */
  @ViewChild('descRef') descRef?: ElementRef<HTMLElement>;

  /** UI state */
  expanded = false;
  showSeeMore = false;

  /** carrusel */
  images: string[] = [];
  currentImgIndex = 0;

  private resizeObs?: ResizeObserver;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['proyecto']) {
      this.images = this.buildImages(this.proyecto);
      this.currentImgIndex = 0;
      this.expanded = false;
      // tras cambio de datos, revaluar overflow en el próximo ciclo
      queueMicrotask(() => this.checkOverflow());
    }
  }

  ngAfterViewInit(): void {
    // observar cambios de tamaño para recalcular overflow
    this.resizeObs = new ResizeObserver(() => this.checkOverflow());
    if (this.descRef?.nativeElement) this.resizeObs.observe(this.descRef.nativeElement);
    this.checkOverflow();
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
  }

  /** Imagen actual */
  get currentImgSrc(): string {
    if (!this.images.length) return this.placeholder;
    const i = Math.min(Math.max(this.currentImgIndex, 0), this.images.length - 1);
    return this.images[i] || this.placeholder;
  }

  /** toggles */
  toggleExpand(ev?: Event): void {
    ev?.stopPropagation();
    this.expanded = !this.expanded;
    // al expandir/colapsar no necesitamos forzar ver más; se recalcula por si cambia clamp
    this.cdr.markForCheck();
  }

  /** carrusel */
  prevImg(ev?: Event) {
    ev?.stopPropagation();
    if (!this.images.length) return;
    this.currentImgIndex = (this.currentImgIndex - 1 + this.images.length) % this.images.length;
    this.cdr.markForCheck();
  }

  nextImg(ev?: Event) {
    ev?.stopPropagation();
    if (!this.images.length) return;
    this.currentImgIndex = (this.currentImgIndex + 1) % this.images.length;
    this.cdr.markForCheck();
  }

  /** clases por estado */
  get estadoClass(): string {
    const e = (this.proyecto?.estado || '').toUpperCase();
    if (e === 'PLANIFICADO') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (e === 'EN_CURSO')     return 'bg-green-50 text-green-700 border-green-200';
    if (e === 'CERRADO')      return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  /** utils */
  private buildImages(p?: VmProyecto): string[] {
    if (!p) return [];
    const cover = p.cover_url ? [p.cover_url] : [];
    const list = (p.imagenes ?? []).map(i => i?.url || '').filter(Boolean);
    const all = [...cover, ...list];
    if (all.length === 0) return [this.defaultByModalidad(p.modalidad)];
    return Array.from(new Set(all));
  }

  private defaultByModalidad(mod?: string): string {
    const m = (mod || '').toUpperCase();
    if (m === 'PRESENCIAL') return '/assets/proyectos/presencial.svg';
    if (m === 'VIRTUAL')    return '/assets/proyectos/virtual.svg';
    if (m === 'MIXTA')      return '/assets/proyectos/mixta.svg';
    return '/assets/proyectos/default.svg';
  }

  private checkOverflow(): void {
    const el = this.descRef?.nativeElement;
    if (!el) return;

    // Aplicamos clamp solo cuando NO está expandido; medir con clamp activo
    const was = this.showSeeMore;
    // overflow si el contenido real (scrollHeight) supera la altura visible (clientHeight)
    this.showSeeMore = !this.expanded && el.scrollHeight > el.clientHeight + 1; // +1 para tolerancias

    if (was !== this.showSeeMore) this.cdr.markForCheck();
  }

  /** placeholder SVG embebido */
  private readonly placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225">
      <rect width="400" height="225" fill="#e8ecff"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-family="system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif"
            font-size="18" fill="#64748b">Sin imagen</text>
    </svg>
  `);
}
