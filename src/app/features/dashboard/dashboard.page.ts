import { Component, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { VmProyecto } from '../vm/models/proyecto.models';

@Component({
  standalone: true,
  imports: [TranslocoPipe, ],
  template: `
    <h1 class="text-2xl font-bold mb-4">{{ 'app.dashboard' | transloco }}</h1>
    <p class="mb-6">{{ 'app.hello' | transloco }} 👋</p>

    <button class="mb-10 border rounded px-3 py-1 text-sm"
            (click)="toggleLang()">
      Toggle lang ({{ lang }})
    </button>

    <!-- DEMO DE TARJETA -->

  `
})
export class DashboardPage {
  private t = inject(TranslocoService);
  lang = this.t.getActiveLang();

  /** Proyecto de ejemplo para mostrar el diseño */
  demoProyecto: VmProyecto = {
    id: 1,
    codigo: 'PRJ-2025-001',
    titulo: 'Proyecto de Innovación Educativa',
    tipo: 'VINCULADO',
    modalidad: 'PRESENCIAL',
    estado: 'EN_CURSO',
    nivel: 3,
    descripcion: 'Este proyecto busca integrar nuevas metodologías de enseñanza basadas en tecnología.',
    ep_sede_id: 101,
    periodo_id: 2025,
    horas_planificadas: 120,
    horas_minimas_participante: 60,
    created_at: '2025-09-12T00:00:00Z',
    cover_url: '', // Puedes dejar vacío para probar el fallback
    imagenes: [],
    imagenes_total: 0
  };

  toggleLang() {
    this.lang = this.lang === 'es' ? 'en' : 'es';
    this.t.setActiveLang(this.lang);
    document.documentElement.lang = this.lang;
    localStorage.setItem('lang', this.lang);
  }

  onInscribirse(proyectoId: number) {
    console.log('🟢 Usuario desea inscribirse al proyecto:', proyectoId);
    alert(`Te inscribiste al proyecto con ID: ${proyectoId}`);
  }
}
