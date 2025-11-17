import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VmApiService } from '../../data-access/vm.api';
import { VmQrVentanaQR } from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-qr-page',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './proyecto-qr.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoQrPage implements OnDestroy, OnInit {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);

  // UI state
  loading = signal(false);
  error   = signal<string | null>(null);

  // Código del backend: 'QR_OPENED' | 'QR_RENEWED' | 'QR_ALREADY_OPEN'
  qrStatusCode = signal<string | null>(null);

  // Params
  sesionId = signal<number>(0);

  // Config
  maxUsos      = new FormControl<number | null>(null);
  radioM       = new FormControl<number>(120, { nonNullable: true });
  usarGeocerca = signal<boolean>(false);
  geo          = signal<{ lat: number; lng: number } | null>(null);

  // Resultado de la API
  ventana = signal<VmQrVentanaQR | null>(null);

  // Canvas para el QR
  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  // reloj (opcional por si luego quieres actualizar algo cada X tiempo)
  private clock: any;

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('sesionId'));
    this.sesionId.set(id);

    // opcional: mantener un “tick” si luego quieres refrescar algo cada X tiempo
    this.clock = setInterval(() => {}, 30_000);
  }

  ngOnInit(): void {
    // Al entrar a la pantalla, intenta obtener el QR vigente.
    // - Si ya hay uno, el backend lo devuelve (QR_ALREADY_OPEN).
    // - Si no hay, crea uno nuevo (QR_OPENED).
    this.abrirQr(false);
  }

  ngOnDestroy(): void {
    if (this.clock) clearInterval(this.clock);
  }

  toggleGeocerca(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.usarGeocerca.set(checked);
    if (!checked) this.geo.set(null);
  }

  async detectarUbicacion() {
    this.error.set(null);
    if (!('geolocation' in navigator)) {
      this.error.set('Este navegador no soporta geolocalización.');
      return;
    }
    this.loading.set(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 0,
        })
      );
      this.geo.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: any) {
      this.error.set(e?.message || 'No se pudo obtener la ubicación.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Abre o reutiliza un QR:
   * - renovar = false → si ya hay un QR vigente, el backend devuelve ese mismo (QR_ALREADY_OPEN)
   * - renovar = true  → backend desactiva el anterior y crea uno nuevo (QR_RENEWED)
   */
  async abrirQr(renovar: boolean = false) {
    this.error.set(null);
    this.loading.set(true);
    this.qrStatusCode.set(null);

    try {
      const payload: any = {};
      const max = this.maxUsos.value;
      if (typeof max === 'number' && max > 0) {
        payload.max_usos = max;
      }

      if (this.usarGeocerca() && this.geo()) {
        payload.lat = this.geo()!.lat;
        payload.lng = this.geo()!.lng;
        const r = this.radioM.value ?? 120;
        payload.radio_m = Math.max(10, Math.min(5000, Number(r)));
      }

      if (renovar) {
        payload.renovar = true;
      }

      // La API debe devolver: { ok, code, data }
      const resp: any = await firstValueFrom(
        this.api.abrirVentanaQr(this.sesionId(), payload)
      );

      if (!resp?.ok) {
        throw new Error(resp?.message || 'No se pudo abrir el QR');
      }

      this.ventana.set(resp.data);
      this.qrStatusCode.set(resp.code || 'QR_OPENED');

      // Render del QR en el canvas
      setTimeout(() => this.renderQr(), 0);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Error al abrir QR.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Renovar QR → fuerza crear uno nuevo en backend.
   */
  async reiniciarQr() {
    await this.abrirQr(true);
  }

  private async renderQr() {
    if (!this.qrCanvas?.nativeElement || !this.ventana()) return;

    const canvas = this.qrCanvas.nativeElement;

    // Contenido del QR (simple): el token
    const content = this.ventana()!.token;

    // Alternativa: deep-link propio
    // const content = `vm://checkin?s=${this.sesionId()}&t=${this.ventana()!.token}`;

    const QRCode = await import('qrcode');
    await QRCode.toCanvas(canvas, content, {
      margin: 1,
      scale: 6,
      errorCorrectionLevel: 'M',
    });
  }

  copiarToken(token: string) {
    navigator.clipboard?.writeText(token);
  }

  descargarPng() {
    if (!this.qrCanvas?.nativeElement) return;
    const link = document.createElement('a');
    link.href = this.qrCanvas.nativeElement.toDataURL('image/png');
    link.download = `sesion-${this.sesionId()}-qr.png`;
    link.click();
  }
}
