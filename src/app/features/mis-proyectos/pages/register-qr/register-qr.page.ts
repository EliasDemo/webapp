import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { VmApiService } from '../../../vm/data-access/vm.api';

type CheckInOk = { asistencia: any; ventana_fin: string };

@Component({
  standalone: true,
  selector: 'app-register-qr',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ZXingScannerModule],
  templateUrl: './register-qr.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterQrPage {
  private route = inject(ActivatedRoute);
  private api   = inject(VmApiService);

  // route
  readonly sesionId = signal<number>(Number(this.route.snapshot.paramMap.get('sesionId') || 0));

  // ui state
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly success   = signal<CheckInOk | null>(null);
  readonly info      = signal<string | null>(null);

  // camera / scanner
  readonly hasPermission   = signal<boolean | null>(null);
  readonly cameras         = signal<MediaDeviceInfo[]>([]);
  readonly selectedDevice  = signal<MediaDeviceInfo | null>(null);
  readonly scannerEnabled  = signal(true);

  // token + geo
  readonly token = new FormControl<string>('', { nonNullable: true });
  readonly useGeo = signal(true);
  readonly coords = signal<{ lat: number; lng: number } | null>(null);
  readonly geoError = signal<string | null>(null);

  // helpers para render
  readonly mayScan = computed(() =>
    this.scannerEnabled() && this.hasPermission() === true && !this.loading() && !this.success()
  );

  // ==================== Scanner callbacks ====================

  onCamerasFound(devs: MediaDeviceInfo[]) {
    this.cameras.set(devs || []);
    // elegir trasera por defecto si existe
    const back = devs.find(d => /back|rear|environment/i.test(d.label));
    this.selectedDevice.set(back || devs[0] || null);
  }

  onCamerasNotFound() {
    this.cameras.set([]);
    this.selectedDevice.set(null);
    this.error.set('No se encontraron cámaras disponibles.');
  }

  onPermissionResponse(ok: boolean) {
    this.hasPermission.set(ok);
    if (!ok) this.error.set('Permiso de cámara denegado. Habilítalo para escanear el QR.');
  }

  async onScanSuccess(raw: string) {
    if (!raw || this.loading() || this.success()) return;
    const token = this.extractToken(raw);
    if (!token) {
      this.error.set('El código QR leído no es válido.');
      return;
    }
    this.token.setValue(token);
    await this.doRegister(token);
  }

  // Cambio manual de cámara desde el selector
  onDeviceChange(event: Event) {
    const index = (event.target as HTMLSelectElement).selectedIndex;
    const dev = this.cameras()[index] || null;
    this.selectedDevice.set(dev);
  }

  // ==================== Acciones ====================

  async registrarManual() {
    const raw = (this.token.value || '').trim();
    if (!raw) return;
    const token = this.extractToken(raw) ?? raw;
    await this.doRegister(token);
  }

  async doRegister(token: string) {
    this.error.set(null);
    this.info.set(null);
    this.geoError.set(null);
    this.loading.set(true);

    // Geo (opcional)
    let lat: number | undefined;
    let lng: number | undefined;

    if (this.useGeo()) {
      try {
        const g = await this.getLocation({ enableHighAccuracy: true, timeout: 7000, maximumAge: 0 });
        if (g) {
          lat = g.lat; lng = g.lng;
          this.coords.set(g);
        } else {
          this.info.set('No se pudo obtener ubicación (continuando sin GPS).');
        }
      } catch (e: any) {
        this.geoError.set('No se pudo obtener la ubicación. Puedes intentar nuevamente o continuar sin GPS.');
      }
    }

    try {
      const res = await this.api
        .checkInQr(this.sesionId(), { token, lat, lng })
        .toPromise();

      if (!res || res.ok !== true) {
        const msg = (res as any)?.message || 'No se pudo registrar la asistencia.';
        this.error.set(this.translateBackendError((res as any)?.code, msg));
        return;
      }

      // Éxito
      this.success.set(res.data);
      this.scannerEnabled.set(false);
      this.info.set('¡Asistencia registrada!');
    } catch (err: any) {
      const code = err?.error?.code;
      const msg  = err?.error?.message || 'No se pudo registrar la asistencia.';
      this.error.set(this.translateBackendError(code, msg));
    } finally {
      this.loading.set(false);
    }
  }

  reset() {
    this.success.set(null);
    this.error.set(null);
    this.info.set(null);
    this.token.setValue('');
    this.scannerEnabled.set(true);
  }

  // ==================== Util ====================

  private extractToken(raw: string): string | null {
    const s = (raw || '').trim();

    // 1) token puro (32 hex)
    if (/^[a-f0-9]{32}$/i.test(s)) return s;

    // 2) URL con ?t= o ?token=
    try {
      const u = new URL(s);
      const t = u.searchParams.get('t') || u.searchParams.get('token');
      if (t) return t;
    } catch { /* no era URL */ }

    // 3) JSON con { "t": "..." } o { "token": "..." }
    try {
      const obj = JSON.parse(s);
      if (typeof obj?.t === 'string') return obj.t;
      if (typeof obj?.token === 'string') return obj.token;
    } catch { /* no era JSON */ }

    return null;
  }

  private getLocation(opts?: PositionOptions): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        opts
      );
    });
  }

  private translateBackendError(code?: string, fallback = 'Ocurrió un error'): string {
    switch (code) {
      case 'TOKEN_INVALIDO':       return 'El QR es inválido o ya no está activo.';
      case 'SESION_SIN_EP_SEDE':   return 'La sesión no está correctamente configurada (EP_SEDE).';
      case 'NO_INSCRITO':          return 'No estás inscrito/confirmado en esta actividad.';
      case 'VENTANA_NO_ACTIVA':    return 'La ventana para registrar por QR no está activa.';
      case 'GEOFENCE_OUT_OF_RANGE':
      case 'GEOFENCE_REQUIRED':    return 'Debes estar dentro del área permitida para registrar tu asistencia.';
      case 'TOKEN_EXPIRO':         return 'El QR ya expiró. Solicita al docente abrirlo nuevamente.';
      default:                     return fallback;
    }
  }
}
