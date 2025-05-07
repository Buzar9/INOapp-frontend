import { enableProdMode, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/components/app/app.component';
import { environment } from './environments/environment';
import { provideAnimations } from '@angular/platform-browser/animations';

// AngularFire (Standalone)
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app/app.routes';

import './styles.css';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    importProvidersFrom(
      AngularFireModule.initializeApp(environment.firebase),
      AngularFirestoreModule
    ),
    provideRouter(routes),
  ],
})
  .then(() => {
    if ('serviceWorker' in navigator && environment.production) {
      navigator.serviceWorker
        .register('service-worker.js')
        .then((reg) => console.log('SW zarejestrowany:', reg.scope))
        .catch((err) => console.error('Błąd rejestracji SW:', err));
    }
  })
  .catch((err) => console.error(err));
