import { Component, OnDestroy, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { VmApiService } from '../../data-access/vm.api';
import {
  isApiOk,
  VmVentanaManual,
  ListadoAsistenciaRow,
  ParticipanteSesionRow,
} from '../../models/proyecto.models';

@Component({
  standalone: true,
  selector: 'app-proyecto-assistance-page',
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './proyecto-assistance.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyectoAssistancePage implements OnDestroy {
  private api = inject(VmApiService);
  private route = inject(ActivatedRoute);

  // --- state (signals) ---
  sesionId = signal<number>(0);
  loading = signal(true);
  error = signal<string | null>(null);

  ventana = signal<VmVentanaManual | null>(null);
  asistencias = signal<ReadonlyArray<ListadoAsistenciaRow>>([]);
  participantes = signal<ReadonlyArray<ParticipanteSesionRow>>([]);

  now = signal(new Date());
  lastSync = signal<Date | null>(null);

  // input por CÓDIGO (nuevo backend)
  codigo = new FormControl<string>('', { nonNullable: true });

  // --- timers / cache ---
  private pollTimer: any;    // asistencias (cada 5s con ETag)
  private clock: any;        // reloj UI
  private etag: string | undefined;

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('sesionId'));
    this.sesionId.set(id);

    this.bootstrap();

    // Poll “condicional” cada 5s con ETag (sin parpadeo si no cambió)
    this.pollTimer = setInterval(() => this.refreshAsistencias(), 5000);

    // Reloj para “Ahora:” y countdown cada 30s
    this.clock = setInterval(() => this.now.set(new Date()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.clock) clearInterval(this.clock);
  }

  // ----------------- boot -----------------
  private async bootstrap() {
    this.loading.set(true);
    try {
      await this.activarManual();            // abre/renueva ventana (±1h alineado al horario)
      await this.refreshAsistencias(true);   // primera carga (forzada ignora ETag)
      await this.loadParticipantes();        // carga participantes
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo inicializar la página de asistencia.');
    } finally {
      this.loading.set(false);
    }
  }

  // ----------------- acciones -----------------
  async activarManual() {
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.activarVentanaManual(this.sesionId()));
      if (!res || !isApiOk(res)) {
        throw new Error((res as any)?.message || 'Fallo al activar el llamado manual.');
      }
      this.ventana.set(res.data);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo activar la ventana manual.');
    }
  }

  async doCheckIn() {
    const cod = (this.codigo.value || '').trim();
    if (!cod) return;

    try {
      const res = await firstValueFrom(this.api.checkInManualPorCodigo(this.sesionId(), cod));
      if (res && isApiOk(res)) {
        this.codigo.setValue('');
        await this.refreshAsistencias(true);
        await this.loadParticipantes();
      } else {
        alert((res as any)?.message || 'No se pudo registrar.');
      }
    } catch (e: any) {
      alert(e?.error?.message || 'Error al registrar.');
    }
  }

  async doRegisterFromRow(row: ParticipanteSesionRow) {
    if (!row?.codigo) return;
    try {
      const res = await firstValueFrom(this.api.checkInManualPorCodigo(this.sesionId(), row.codigo));
      if (res && isApiOk(res)) {
        await this.refreshAsistencias(true);
        await this.loadParticipantes();
      } else {
        alert((res as any)?.message || 'No se pudo registrar.');
      }
    } catch (e: any) {
      alert(e?.error?.message || 'Error al registrar.');
    }
  }

  async justificarFueraDeHora(row: ParticipanteSesionRow) {
    if (!row?.codigo) return;
    const motivo = prompt(`Justificación para ${row.nombres ?? ''} ${row.apellidos ?? ''} (código ${row.codigo}):`);
    if (!motivo || !motivo.trim()) return;

    const otorgar = confirm('¿Otorgar horas de la sesión?');
    try {
      const res = await firstValueFrom(
        this.api.checkInFueraDeHora(this.sesionId(), {
          codigo: row.codigo,
          justificacion: motivo.trim(),
          otorgar_horas: otorgar,
        })
      );
      if (res && isApiOk(res)) {
        await this.refreshAsistencias(true);
        await this.loadParticipantes();
      } else {
        alert((res as any)?.message || 'No se pudo justificar la asistencia.');
      }
    } catch (e: any) {
      alert(e?.error?.message || 'Error al justificar la asistencia.');
    }
  }

  async validarTodo() {
    try {
      const res = await firstValueFrom(this.api.validarAsistenciasSesion(this.sesionId(), {}));
      if (!res || !isApiOk(res)) {
        alert((res as any)?.message || 'No se pudo validar.');
        return;
      }
      await this.refreshAsistencias(true);
      await this.loadParticipantes();
    } catch (e: any) {
      alert(e?.error?.message || 'Error al validar.');
    }
  }

  // ----------------- polling condicional -----------------
  /**
   * Refresca la lista de asistencias (con ETag).
   * Si `force===true`, ignora el ETag para asegurar 200 + contenido completo.
   */
  async refreshAsistencias(force = false) {
    try {
      const etagToSend = force ? undefined : this.etag;
      const resp = await firstValueFrom(
        this.api.listarAsistenciasSesionPoll(this.sesionId(), etagToSend)
      );

      if (resp.ok && resp.notModified) {
        return; // 304 → sin cambios → no tocamos la UI
      }

      if (resp.ok && resp.data) {
        this.asistencias.set(resp.data);
        this.etag = resp.etag;
        // Usa Last-Modified si viene; si no, usa ahora().
        const lm = resp.lastModified ? new Date(resp.lastModified) : new Date();
        this.lastSync.set(lm);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo actualizar asistencias.');
    }
  }

  async loadParticipantes() {
    try {
      const res = await firstValueFrom(this.api.listarParticipantesSesion(this.sesionId()));
      if (res && isApiOk(res)) {
        this.participantes.set(res.data ?? []);
      } else {
        this.participantes.set([]);
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo listar participantes.');
    }
  }

  // ----------------- utilidades -----------------
  minutosRestantes(): number | null {
    const v = this.ventana();
    if (!v?.expires_at) return null;
    const t = new Date(v.expires_at).getTime();
    const n = this.now().getTime();
    const m = Math.ceil((t - n) / 60000);
    return m > 0 ? m : 0;
  }

  // Mantiene identidad por fila → no se pierde foco ni hay reflow innecesario
  trackByAsistencia = (_: number, r: ListadoAsistenciaRow) => r.id;
  trackByParticipante = (_: number, r: ParticipanteSesionRow) => r.participacion_id;
}
