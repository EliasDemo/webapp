import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EvApiService } from '../../events/data-access/ev-api.service';
import { VmEvento } from '../../events/models/ev.models';

@Component({
  standalone: true,
  selector: 'app-mis-vent-view-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './mis-vent-view.html',
  styleUrls: [],
})
export class MisVentViewPage {
  private api    = inject(EvApiService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  error   = signal<string | null>(null);
  data    = signal<VmEvento | null>(null);

  // Guardamos el último ID para reintentar
  private lastEventoId = signal<number | null>(null);

  evento = computed(() => this.data());

  portadaUrl = computed(() => {
    const e = this.evento();
    return e?.url_imagen_portada || null;
  });

  constructor() {
    this.route.paramMap.subscribe(async (pm) => {
      const raw = pm.get('eventoId') ?? pm.get('id');
      const id = Number(raw);
      if (!Number.isFinite(id) || id <= 0) {
        this.error.set('ID de evento inválido.');
        this.loading.set(false);
        return;
      }
      this.lastEventoId.set(id);
      await this.fetchEvento(id);
    });
  }

  private async fetchEvento(id: number) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.api.obtenerEvento(id));
      if (res && res.ok) {
        this.data.set(res.data);
      } else {
        this.error.set((res as any)?.message || 'No se pudo cargar el evento.');
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'No se pudo cargar el evento.');
    } finally {
      this.loading.set(false);
    }
  }

  // Método público que usa el template para reintentar
  async reintentar(): Promise<void> {
    const id = this.lastEventoId();
    if (!id || id <= 0) return;
    await this.fetchEvento(id);
  }

  headerEstadoBadge(): string {
    const s = String(this.evento()?.estado ?? '').toUpperCase();
    if (s === 'PLANIFICADO') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s === 'EN_CURSO')    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'CERRADO')     return 'bg-slate-100 text-slate-700 border-slate-200';
    if (s === 'CANCELADO')   return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  periodoEtiqueta(): string {
    const e = this.evento();
    if (!e) return '—';
    if (e.periodo) return `${e.periodo.anio} - ${e.periodo.ciclo}`;
    return `Período ${e.periodo_id}`;
  }

  volverAlListado(): void {
    this.router.navigate(['/mis-eventos']);
  }

  scrollTo(section: 'resumen' | 'inscripcion') {
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
