import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';  // Asegúrate de importar desde el archivo correcto
import { RouterOutlet } from '@angular/router';  // Importa RouterOutlet desde @angular/router

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterOutlet],  // Importa AppComponent y RouterOutlet
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);  // Usa AppComponent aquí
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);  // Usa AppComponent aquí
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, webapp');
  });
});
