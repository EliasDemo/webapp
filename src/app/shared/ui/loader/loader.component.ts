// shared/ui/loader/loader.component.ts
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LoaderService } from './loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css'], // animaciones personalizadas
})
export class LoaderComponent {
  loader = inject(LoaderService);
}
