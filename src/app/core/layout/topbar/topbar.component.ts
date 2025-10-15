import {
  Component, ElementRef, EventEmitter, HostListener, Output, inject, signal, computed
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf, NgClass } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserStore } from '../../state/user.store';
import { AuthApi } from '../../../features/auth/data-access/auth.api';
import { AlertService } from '../../../shared/ui/alert/alert.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [NgIf, NgIf, RouterLink, TranslocoPipe],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private el = inject(ElementRef);
  private router = inject(Router);
  private alerts = inject(AlertService);
  private auth = inject(AuthApi);
  private userStore = inject(UserStore);

  open = signal(false);
  logoOk = signal(true);

  name   = this.userStore.name;   // Signal<string | null>
  email  = this.userStore.email;  // Signal<string | null>
  photo  = this.userStore.photo;  // Signal<string | null>
  status = this.userStore.status; // Signal<string | null>

  /** Evita usar ?. en la plantilla y el warning del template checker */
  statusLower = computed(() => (this.status() ?? 'activo').toLowerCase());

  onLogoError() {
    this.logoOk.set(false);
  }

  initials() {
    const n = this.name();
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    return (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '');
  }

  toggleMenu() {
    this.open.set(!this.open());
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.el.nativeElement.contains(ev.target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.open.set(false);
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.alerts.success('Sesión cerrada correctamente');
        this.userStore.clear();
        this.router.navigateByUrl('/auth/login');
        this.open.set(false);
      },
      error: () => {
        this.userStore.clear();
        this.router.navigateByUrl('/auth/login');
        this.open.set(false);
      }
    });
  }
}
