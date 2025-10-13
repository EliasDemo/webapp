// src/app/shared/ui/icon/icon.component.ts
import { Component, Input } from '@angular/core';
@Component({ selector: 'app-icon', standalone: true,
  template: `<i [class]="'icon-' + name" [style.fontSize.px]="size || 18" aria-hidden="true"></i>` })
export class IconComponent { @Input() name!: string; @Input() size?: number; }
