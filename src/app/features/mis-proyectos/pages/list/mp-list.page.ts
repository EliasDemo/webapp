import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { VmApiService } from '../../../vm/data-access/vm.api';
import {
  VmProyecto,
  ProyectosAlumnoData,
  AlumnoProyectoAgenda,
  EnrolResponse,
  ApiResponse,
} from '../../../vm/models/proyecto.models';

@Component({
  standalone: true,
  selector: 'mp-list-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './mp-list.page.html',
  styleUrls: ['./mp-list.page.scss'],
})
export class MpListPage {
  private api = inject(VmApiService);

  loading = signal(true);
  error   = signal<string | null>(null);

  ctx = signal<ProyectosAlumnoData['contexto'] | null>(null);
  dataAlumno = signal<ProyectosAlumnoData | null>(null);
  agenda = signal<AlumnoProyectoAgenda[] | null>(null);

  // 1) Inscritos = agenda del periodo + vinculados pendientes
  inscritos = computed<VmProyecto[]>(() => {
    const ag = this.agenda() ?? [];
    const pend = this.dataAlumno()?.pendientes ?? [];
    const a1 = ag.map(a => a.proyecto);
    const a2 = pend.map(p => p.proyecto);
    const map = new Map<number, VmProyecto>();
    [...a1, ...a2].forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  });

  // 2) Para este período
  vinculados = computed<VmProyecto[]>(() => this.dataAlumno()?.inscribibles_prioridad ?? []);
  libres     = computed<VmProyecto[]>(() => this.dataAlumno()?.libres ?? []);

  // 3) Historial (placeholder por ahora)
  historiales = signal<VmProyecto[]>([]);

  periodoCodigo   = computed(() => this.ctx()?.periodo_codigo ?? '—');
  nivelObjetivo   = computed(() => this.ctx()?.nivel_objetivo ?? null);
  tienePendiente  = computed(() => this.ctx()?.tiene_pendiente_vinculado ?? false);

  constructor() { this.loadAll(); }

  loadAll() {
    this.loading.set(true);
    this.error.set(null);

    // 1) Proyectos alumno (contexto + inscribibles + libres + pendientes)
    this.api.listarProyectosAlumno().subscribe({
      next: (res: ApiResponse<ProyectosAlumnoData>) => {
        if ((res as any)?.ok !== true) {
          this.error.set((res as any)?.message || 'No se pudo cargar tus proyectos');
          return;
        }
        const data = (res as any).data as ProyectosAlumnoData;
        this.dataAlumno.set(data);
        this.ctx.set(data.contexto ?? null);
        // Si más adelante agregas historial en el backend, aquí lo asignas.
        // this.historiales.set(data.historial ?? []);
      },
      error: () => this.error.set('No se pudo cargar tus proyectos'),
      complete: () => {
        // 2) Agenda alumno (inscritos del periodo)
        this.api.obtenerAgendaAlumno().subscribe({
          next: (res) => {
            if ((res as any)?.ok !== true) {
              this.agenda.set([]);
              return;
            }
            this.agenda.set((res as any).data ?? []);
          },
          error: () => this.agenda.set([]),
          complete: () => this.loading.set(false)
        });
      }
    });
  }

  inscribirse(proyecto: VmProyecto | number) {
    const proyectoId = typeof proyecto === 'number' ? proyecto : proyecto.id;

    this.api.inscribirseProyecto(proyectoId).subscribe({
      next: (r: EnrolResponse) => {
        if ((r as any)?.ok === true) {
          alert('¡Inscripción exitosa!');
          this.loadAll();
        } else {
          const body = r as any;
          const msg = body?.message || 'No se pudo inscribirse.';
          alert(`Error: ${msg}`);
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Error de red al inscribirse.';
        alert(msg);
      }
    });
  }

  // Imagen del proyecto: cover → primera imagen → fallback por modalidad → genérico
  getImageSrc(proyecto: VmProyecto): string {
    if (proyecto.cover_url) return proyecto.cover_url;
    const first = proyecto.imagenes?.[0]?.url;
    if (first) return first;

    const mod = (proyecto.modalidad || '').toUpperCase();
    if (mod === 'PRESENCIAL') return 'assets/proyectos/presencial.svg';
    if (mod === 'VIRTUAL')    return 'assets/proyectos/virtual.svg';
    if (mod === 'MIXTA')      return 'assets/proyectos/mixta.svg';
    return 'assets/proyectos/default.svg';
  }

  getEstadoDisplay(estado: string): string {
    const key = (estado || '').toUpperCase();
    const map: Record<string, string> = {
      PLANIFICADO: 'Planificado',
      EN_CURSO: 'En curso',
      CERRADO: 'Cerrado',
      FINALIZADO: 'Finalizado',
    };
    return map[key] ?? estado;
  }

  getModalidadDisplay(modalidad: string): string {
    const key = (modalidad || '').toUpperCase();
    const map: Record<string, string> = {
      PRESENCIAL: 'Presencial',
      VIRTUAL: 'Virtual',
      MIXTA: 'Mixta',
    };
    return map[key] ?? modalidad;
  }
}
