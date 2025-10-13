import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoaderService } from '../../shared/ui/loader/loader.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private loader = inject(LoaderService);
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const show = !req.headers.has('X-No-Spinner');
    if (show) this.loader.show();
    return next.handle(req).pipe(finalize(() => show && this.loader.hide()));
  }
}
