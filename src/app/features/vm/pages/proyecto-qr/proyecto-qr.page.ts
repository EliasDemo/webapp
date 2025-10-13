import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed,
  OnDestroy,
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
export class ProyectoQrPage implements OnDestroy {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);

  // Params
  sesionId = signal<number>(0);

  // Config
  maxUsos = new FormControl<number | null>(null);
  radioM  = new FormControl<number>(120, { nonNullable: true });
  usarGeocerca = signal<boolean>(false);
  geo = signal<{ lat: number; lng: number } | null>(null);

  // Result
  ventana = signal<VmQrVentanaQR | null>(null);

  // canvas ref
  @ViewChild('qrCanvas', { static: false }) qrCanvas?: ElementRef<HTMLCanvasElement>;

  // reloj (opcional, por si quieres refrescar countdown en el html)
  private clock: any;

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('sesionId'));
    this.sesionId.set(id);

    // opcional: actualizar cada 30s algo en la UI si quieres
    this.clock = setInterval(() => {}, 30_000);
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

  async abrirQr() {
    this.error.set(null);
    this.loading.set(true);
    try {
      const payload: any = {};
      const max = this.maxUsos.value;
      if (typeof max === 'number' && max > 0) payload.max_usos = max;

      if (this.usarGeocerca() && this.geo()) {
        payload.lat = this.geo()!.lat;
        payload.lng = this.geo()!.lng;
        const r = this.radioM.value ?? 120;
        payload.radio_m = Math.max(10, Math.min(5000, Number(r)));
      }

      const resp = await firstValueFrom(this.api.abrirVentanaQr(this.sesionId(), payload));
      if (!resp.ok) throw new Error(resp.message || 'No se pudo abrir el QR');

      this.ventana.set(resp.data);
      // pinta el QR
      setTimeout(() => this.renderQr(), 0);
    } catch (e: any) {
      this.error.set(e?.error?.message || e?.message || 'Error al abrir QR.');
    } finally {
      this.loading.set(false);
    }
  }

  async reiniciarQr() {
    // simplemente vuelve a llamar abrirQr() para obtener un nuevo token/ventana
    await this.abrirQr();
  }

  private async renderQr() {
    if (!this.qrCanvas?.nativeElement || !this.ventana()) return;

    const canvas = this.qrCanvas.nativeElement;
    // Contenido del QR:
    // — opción simple: solo el token
    const content = this.ventana()!.token;

    // — si prefieres un deep-link propio:
    // const content = `vm://checkin?s=${this.sesionId()}&t=${this.ventana()!.token}`;

    // Carga dinámica para no romper SSR y no forzar tipos
    const QRCode = await import('qrcode');
    await QRCode.toCanvas(canvas, content, {
      margin: 1,
      scale: 6, // tamaño “decente”
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
