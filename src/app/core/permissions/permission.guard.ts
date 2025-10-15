// src/app/core/permissions/permission.guard.ts
import {
  CanMatchFn, CanActivateFn, Route, UrlSegment, UrlTree, Router
} from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { UserStore } from '../state/user.store';
import { AuthApi } from '../../features/auth/data-access/auth.api';

type Mode = 'any' | 'all';
type Strategy = 'or' | 'and';

type AccessOpts = {
  perms?: string[];              // permisos requeridos
  roles?: string[];              // roles requeridos
  permMode?: Mode;               // how to evaluate perms (default: 'any')
  roleMode?: Mode;               // how to evaluate roles (default: 'any')
  strategy?: Strategy;           // when both perms & roles are provided (default: 'or')
};

/**
 * Asegura que el usuario esté cargado en memoria (si hay token).
 * Úsalo SIEMPRE antes de requirePerms/requireRoles/requireAccess en canMatch.
 */
export const ensureUserLoaded: CanMatchFn = (): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const user = inject(UserStore);
  const auth = inject(AuthApi);
  const router = inject(Router);

  // Si no hay token, manda a login.
  if (!auth.session().token) return router.createUrlTree(['/auth/login']);

  // Si ya está en memoria, sigue.
  if (user.user()) return true;

  // Si no, carga y decide.
  return user.loadIfNeeded$().pipe(
    map(u => (u ? true : router.createUrlTree(['/auth/login'])))
  );
};

/**
 * Requiere una lista de permisos. mode = 'any' (default) o 'all'.
 * Úsalo después de ensureUserLoaded.
 */
export const requirePerms = (perms: string[], mode: Mode = 'any'): CanMatchFn =>
  (_route: Route, _segments: UrlSegment[]): boolean | UrlTree => {
    const user = inject(UserStore);
    const router = inject(Router);

    const ok = !perms?.length
      ? true
      : mode === 'all'
        ? user.hasAll(perms)
        : user.hasAny(perms);

    return ok ? true : router.createUrlTree(['/no-autorizado']);
  };

/**
 * Requiere una lista de roles. mode = 'any' (default) o 'all'.
 * Úsalo después de ensureUserLoaded.
 */
export const requireRoles = (roles: string[], mode: Mode = 'any'): CanMatchFn =>
  (_route: Route, _segments: UrlSegment[]): boolean | UrlTree => {
    const user = inject(UserStore);
    const router = inject(Router);

    const ok = !roles?.length
      ? true
      : mode === 'all'
        ? user.hasAllRole(roles)
        : user.hasAnyRole(roles);

    return ok ? true : router.createUrlTree(['/no-autorizado']);
  };

/**
 * Requiere permisos y/o roles en una sola llamada.
 * strategy:
 *  - 'or'  (default): pasa si PERMS OK **o** ROLES OK
 *  - 'and': pasa si PERMS OK **y** ROLES OK
 */
export const requireAccess = (opts: AccessOpts): CanMatchFn =>
  (_route: Route, _segments: UrlSegment[]): boolean | UrlTree => {
    const user = inject(UserStore);
    const router = inject(Router);

    const {
      perms = [],
      roles = [],
      permMode = 'any',
      roleMode = 'any',
      strategy = 'or',
    } = opts || {};

    const permsOk = !perms.length
      ? true
      : permMode === 'all'
        ? user.hasAll(perms)
        : user.hasAny(perms);

    const rolesOk = !roles.length
      ? true
      : roleMode === 'all'
        ? user.hasAllRole(roles)
        : user.hasAnyRole(roles);

    const ok = (perms.length && roles.length)
      ? (strategy === 'and' ? (permsOk && rolesOk) : (permsOk || rolesOk))
      : (permsOk && rolesOk);

    return ok ? true : router.createUrlTree(['/no-autorizado']);
  };

/** Variante CanActivate por si la necesitas en rutas ya cargadas */
export const activatePerms = (perms: string[], mode: Mode = 'any'): CanActivateFn =>
  () => {
    const user = inject(UserStore);
    const router = inject(Router);

    const ok = !perms?.length
      ? true
      : mode === 'all'
        ? user.hasAll(perms)
        : user.hasAny(perms);

    return ok ? true : router.createUrlTree(['/no-autorizado']);
  };

/** Variante CanActivate basada en roles */
export const activateRoles = (roles: string[], mode: Mode = 'any'): CanActivateFn =>
  () => {
    const user = inject(UserStore);
    const router = inject(Router);

    const ok = !roles?.length
      ? true
      : mode === 'all'
        ? user.hasAllRole(roles)
        : user.hasAnyRole(roles);

    return ok ? true : router.createUrlTree(['/no-autorizado']);
  };
