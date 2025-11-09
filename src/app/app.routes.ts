import { ApplicationConfig } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { OrganizerResultsComponent } from './components/organizer-results/organizer-results.component';
import { WelcomeScreenComponent } from './components/welcome-screen/welcome-screen.component';
import { OrganizerScreenComponent } from './components/organizer-screen/organizer-screen.component';
import { OrganizerCreateCompetitonComponent } from './components/organizer-create-competiton/organizer-create-competition.component';
import { ParticipantRegisterComponent } from './components/participant-register/participant-register.component';
import { ParticipantRunComponent } from './components/participant-run/participant-run.component';

import { OrganizerRouteViewComponent } from './components/organizer-route-view/organizer-route-view.component';
import { OrganizerCategoryViewComponent } from './components/organizer-category-view/organizer-category-view.component';
import { OrganizerUnitsComponent } from './components/organizer-units/organizer-units.component';
import { OrganizerBackgroudMapMenageComponent } from './components/organizer-backgroud-map-menage/organizer-backgroud-map-menage.component';
import { OrganizerBackgroundMapImportComponent } from './components/organizer-background-map-import/organizer-background-map-import.component';

// lazy loading komponentow, bo aplikacja jest zbyt duza
export const routes: Routes = [
  {
    path: '',
    component: WelcomeScreenComponent
  },
  // dodo odświeenie nie moze orac gry!
  {
    path: 'organizer',
    component: OrganizerScreenComponent,
    children:[
      {
        path: 'create_competition',
        component: OrganizerCreateCompetitonComponent
      },
      {
        path: 'results',
        component: OrganizerResultsComponent
      },
      {
        path: 'routes',
        component: OrganizerRouteViewComponent
      },
      {
        path: 'categories',
        component: OrganizerCategoryViewComponent
      },
      {
        path: 'units',
        component: OrganizerUnitsComponent
      },
      {
        path: 'maps',
        component: OrganizerBackgroudMapMenageComponent
      },
      {
        path: '',
        redirectTo: 'create_competition',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'participant/sign_in',
    component: ParticipantRegisterComponent
  },
  {
    path: 'participant/scan',
    component: ParticipantRunComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)]
};

