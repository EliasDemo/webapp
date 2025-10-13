import { inject, Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertService } from '../../shared/ui/alert/alert.service';
import { TranslocoService } from '@jsverse/transloco';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  private alerts = inject(AlertService);
  private t = inject(TranslocoService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 0) {
          this.alerts.error(this.t.translate('alerts.network') || 'No hay conexión con el servidor.');
          return throwError(() => err);
        }

        if (err.status === 403) {
          this.alerts.warn(this.t.translate('alerts.forbidden'));
        } else {
          const fallback = this.t.translate('alerts.unexpected') || 'Ocurrió un error inesperado.';
          const msg = (err.error && (err.error.message || err.error.title)) || fallback;
          this.alerts.error(msg);
        }

        return throwError(() => err);
      })
    );
  }
}
