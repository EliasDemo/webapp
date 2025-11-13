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
  HostListener,
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

  // ───────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────
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

  // ───────────────────────────────────────────────────────────────
  // Getters derivados
  // ───────────────────────────────────────────────────────────────
  /** Imagen actual */
  get currentImgSrc(): string {
    if (!this.images.length) return this.placeholder;
    const i = Math.min(Math.max(this.currentImgIndex, 0), this.images.length - 1);
    return this.images[i] || this.placeholder;
  }

  /** clases por estado */
  get estadoClass(): string {
    const e = (this.proyecto.estado || '').toUpperCase();
    if (e === 'PLANIFICADO') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (e === 'EN_CURSO')     return 'bg-green-50 text-green-700 border-green-200';
    if (e === 'CERRADO')      return 'bg-red-50 text-red-700 border-red-200';
    if (e === 'FINALIZADO')   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (e === 'CANCELADO')    return 'bg-gray-100 text-gray-700 border-gray-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  }

  get estadoLabel(): string {
    return (this.proyecto.estado || '').toUpperCase() || '—';
  }

  /** Eliminar solo cuando está planificado (regla actual) */
  get isEliminable(): boolean {
    return (this.proyecto.estado || '').toUpperCase() === 'PLANIFICADO';
  }

  /** Ciclos mostrados: usa niveles[] si existe; fallback a nivel (compatibilidad) */
  get nivelesLabel(): string | null {
    const arr = Array.isArray(this.proyecto.niveles) && this.proyecto.niveles.length
      ? [...this.proyecto.niveles]
      : (this.proyecto.nivel != null ? [this.proyecto.nivel] : []);
    if (!arr.length) return null;
    return this.compactRanges(arr.sort((a, b) => a - b));
  }

  // ───────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────
  toggleExpand(ev?: Event): void {
    ev?.stopPropagation();
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
    // al expandir/colapsar recalculamos por si cambia la altura
    queueMicrotask(() => this.checkOverflow());
  }

  /** carrusel */
  prevImg(ev?: Event): void {
    ev?.stopPropagation();
    if (!this.images.length) return;
    this.currentImgIndex = (this.currentImgIndex - 1 + this.images.length) % this.images.length;
    this.cdr.markForCheck();
  }

  nextImg(ev?: Event): void {
    ev?.stopPropagation();
    if (!this.images.length) return;
    this.currentImgIndex = (this.currentImgIndex + 1) % this.images.length;
    this.cdr.markForCheck();
  }

  onImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement | null;
    if (el) el.src = this.placeholder;
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.checkOverflow();
  }

  onKeydown(ev: KeyboardEvent): void {
    // mejora de a11y: navegación con teclado
    if (this.images.length > 1) {
      if (ev.key === 'ArrowLeft') { this.prevImg(); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight') { this.nextImg(); ev.preventDefault(); }
    }
  }

  trackByIndex(index: number): number { return index; }

  // ───────────────────────────────────────────────────────────────
  // Utils
  // ───────────────────────────────────────────────────────────────
  private checkOverflow(): void {
    const el = this.descRef?.nativeElement;
    if (!el) { this.showSeeMore = false; return; }

    // Con line-clamp activo, si el contenido real supera lo visible, hay overflow.
    const overflow = el.scrollHeight - el.clientHeight > 2;
    const shouldShow = !this.expanded && overflow;
    if (this.showSeeMore !== shouldShow) {
      this.showSeeMore = shouldShow;
      this.cdr.markForCheck();
    }
  }

  private buildImages(p: VmProyecto): string[] {
    const cover = p.cover_url ? [p.cover_url] : [];
    const list = (p.imagenes ?? []).map(i => i?.url || '').filter(Boolean);
    const all = [...cover, ...list];
    if (all.length === 0) return [this.defaultByModalidad(p.modalidad)];
    // eliminamos duplicados preservando orden
    return Array.from(new Set(all));
  }

  private defaultByModalidad(mod?: string): string {
    const m = (mod || '').toUpperCase();
    if (m === 'PRESENCIAL') return '/assets/proyectos/presencial.svg';
    if (m === 'VIRTUAL')    return '/assets/proyectos/virtual.svg';
    if (m === 'MIXTA')      return '/assets/proyectos/mixta.svg';
    return '/assets/proyectos/default.svg';
  }

  /** Compacta [1,2,3,5,7,8] → "1–3, 5, 7–8" */
  private compactRanges(nums: number[]): string {
    if (!nums.length) return '';
    const out: string[] = [];
    let start = nums[0], prev = nums[0];

    for (let i = 1; i < nums.length; i++) {
      const n = nums[i];
      if (n === prev + 1) { prev = n; continue; }
      out.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = prev = n;
    }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    return out.join(', ');
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
