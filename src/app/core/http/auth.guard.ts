import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';

export const authMatchGuard: CanMatchFn = (): boolean | UrlTree => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  return token ? true : router.createUrlTree(['/auth/login']);
};
