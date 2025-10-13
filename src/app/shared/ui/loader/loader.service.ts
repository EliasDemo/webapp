// src/app/shared/ui/loader/loader.service.ts
import { Injectable } from '@angular/core';
import { LoaderComponent } from './loader.component';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private static _ref: LoaderComponent | null = null;
  register(ref: LoaderComponent) { LoaderService._ref = ref; }
  show() { LoaderService._ref?.show(); }
  hide() { LoaderService._ref?.hide(); }
}
