import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../core/tokens/api-url.token';
import { MeResponse, UserDetail } from './user.models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UserApi {
  private http = inject(HttpClient);
  private base = inject(API_URL); // '/api' si usas proxy

  me(): Observable<UserDetail> {
    return this.http.get<MeResponse>(`${this.base}/users/me`).pipe(
      map(res => res.user)
    );
  }

  byUsername(username: string): Observable<UserDetail> {
    return this.http.get<{ ok: boolean; user: UserDetail }>(`${this.base}/users/by-username/${encodeURIComponent(username)}`)
      .pipe(map(r => r.user));
  }
}
