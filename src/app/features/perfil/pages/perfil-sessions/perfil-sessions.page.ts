// src/app/pages/perfil/pages/perfil-sessions/perfil-sessions.page.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PerfilApiService } from '../../data-access/perfil-api.service';
import { SessionItem } from '../../models/perfil.models';
import { LoaderService } from '../../../../shared/ui/loader/loader.service';

@Component({
  standalone: true,
  selector: 'app-perfil-sessions-page',
  imports: [CommonModule],
  templateUrl: './perfil-sessions.page.html',
})
export class PerfilSessionsPage implements OnInit {
  private perfilApi = inject(PerfilApiService);
  private loader = inject(LoaderService);

  // estado
  loading = signal<boolean>(true);
  errorMsg = signal<string | null>(null);
  sessions = signal<SessionItem[]>([]);
  actionSessionId = signal<string | null>(null); // para deshabilitar botón puntual

  // derivados
  totalSessions = computed(() => this.sessions().length);
  currentSession = computed(
    () => this.sessions().find(s => s.is_current) ?? null
  );
  hasOtherSessions = computed(() =>
    this.sessions().some(s => !s.is_current)
  );

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.listSessions(),
          'Cargando sesiones de inicio de sesión...'
        )
      );

      if (res.ok) {
        this.sessions.set(res.sessions ?? []);
      } else {
        this.errorMsg.set(
          (res as any).message || 'Error al cargar las sesiones'
        );
        this.sessions.set([]);
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('No se pudieron cargar las sesiones');
      this.sessions.set([]);
    } finally {
      this.loading.set(false);
      this.actionSessionId.set(null);
    }
  }

  async cerrarSesion(session: SessionItem): Promise<void> {
    if (session.is_current) {
      // opcional: bloquear cerrar la actual desde aquí
      return;
    }

    const ok = window.confirm(
      '¿Seguro que quieres cerrar esta sesión en particular?'
    );
    if (!ok) return;

    this.actionSessionId.set(session.id);
    this.errorMsg.set(null);

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.revokeSession(session.id),
          'Cerrando sesión...'
        )
      );

      if (res.ok) {
        // tras cerrar, refrescamos lista
        await this.reload();
      } else {
        this.errorMsg.set(
          (res as any).message || 'No se pudo cerrar la sesión seleccionada'
        );
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('Error al cerrar la sesión');
    } finally {
      this.actionSessionId.set(null);
    }
  }

  async cerrarOtrasSesiones(): Promise<void> {
    if (!this.hasOtherSessions()) return;

    const ok = window.confirm(
      'Se cerrarán todas tus otras sesiones en otros dispositivos/navegadores. ¿Continuar?'
    );
    if (!ok) return;

    this.loading.set(true);
    this.errorMsg.set(null);

    try {
      const res = await firstValueFrom(
        this.loader.track(
          this.perfilApi.revokeOtherSessions(),
          'Cerrando otras sesiones...'
        )
      );

      if (res.ok) {
        // muchas APIs devuelven las sesiones restantes; si no, simplemente recargamos
        await this.reload();
      } else {
        this.errorMsg.set(
          (res as any).message || 'No se pudieron cerrar las otras sesiones'
        );
      }
    } catch (e: any) {
      console.error(e);
      this.errorMsg.set('Error al cerrar las otras sesiones');
    } finally {
      this.loading.set(false);
    }
  }

  // Helpers de UI
  shortId(s: SessionItem): string {
    if (!s.id) return '';
    if (s.id.length <= 10) return s.id;
    return `${s.id.slice(0, 6)}…${s.id.slice(-4)}`;
  }

  lastActivityLabel(s: SessionItem): string {
    return s.last_activity || '—';
  }

  createdAtLabel(s: SessionItem): string {
    // como created_at es opcional, caemos a last_activity si no viene
    const anyS = s as any;
    return anyS.created_at || s.last_activity || '—';
  }

  deviceLabel(s: SessionItem): string {
    if (!s.user_agent) return 'Dispositivo desconocido';

    const ua = s.user_agent.toLowerCase();

    if (ua.includes('mobile')) return 'Móvil';
    if (ua.includes('tablet')) return 'Tablet';
    if (ua.includes('windows')) return 'PC · Windows';
    if (ua.includes('mac os') || ua.includes('macintosh')) return 'Mac';
    if (ua.includes('linux')) return 'PC · Linux';

    return 'Dispositivo';
  }

  browserLabel(s: SessionItem): string {
    const ua = (s.user_agent || '').toLowerCase();
    if (ua.includes('chrome') && !ua.includes('edge') && !ua.includes('opr'))
      return 'Chrome';
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('opr') || ua.includes('opera')) return 'Opera';
    return 'Navegador';
  }
}
