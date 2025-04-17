import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./components/app/app.component').then(m=>m.AppComponent),
    },
    {
        path: 'organizer/:accessKey',
        loadComponent: () => import('./components/organizer-results/organizer-results.component').then(m => m.OrganizerResultsComponent)
    },
    {
        path: '**',
        redirectTo: '',
    }
];
