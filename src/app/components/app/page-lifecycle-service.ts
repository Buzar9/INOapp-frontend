// // page-lifecycle.service.ts
// import { Injectable, NgZone } from '@angular/core';
// import { Observable, Subject } from 'rxjs';

// @Injectable({
//   providedIn: 'root'
// })
// export class PageLifecycleService {
//   private pageHideSubject = new Subject<PageTransitionEvent>();
//   private pageShowSubject = new Subject<PageTransitionEvent>();
//   private beforeUnloadSubject = new Subject<BeforeUnloadEvent>();
//   private unloadSubject = new Subject<Event>();

//   constructor(private ngZone: NgZone) {
//     // Zdarzenie pagehide – gdy strona wychodzi z widoku lub trafia do tła
//     window.addEventListener('pagehide', (event: PageTransitionEvent) => {
//       this.ngZone.run(() => {
//         console.log('pagehide event:', event);
//         this.pageHideSubject.next(event);
//       });
//     });

//     // Zdarzenie pageshow – gdy strona ponownie pojawia się na widoku
//     window.addEventListener('pageshow', (event: PageTransitionEvent) => {
//       this.ngZone.run(() => {
//         console.log('pageshow event:', event);
//         this.pageShowSubject.next(event);
//       });
//     });

//     // Zdarzenie beforeunload – wywoływane tuż przed opuszczeniem strony.
//     // Możesz próbować pokazać użytkownikowi potwierdzenie opuszczenia.
//     window.addEventListener('beforeunload', (event: BeforeUnloadEvent) => {
//       this.ngZone.run(() => {
//         console.log('beforeunload event:', event);
//         this.beforeUnloadSubject.next(event);
//         // Aby wyświetlić komunikat potwierdzający opuszczenie, należy ustawić property event.returnValue.
//         // Uwaga: Nowoczesne przeglądarki często ignorują własny komunikat.
//         event.returnValue = 'Czy na pewno chcesz opuścić stronę?';
//       });
//     });

//     // Zdarzenie unload – uruchamiane, gdy strona faktycznie jest opuszczana
//     window.addEventListener('unload', (event: Event) => {
//       this.ngZone.run(() => {
//         console.log('unload event:', event);
//         this.unloadSubject.next(event);
//       });
//     });
//   }

//   // Metody zwracające Observable, aby można było subskrybować zdarzenia w komponentach:
//   get pageHide$(): Observable<PageTransitionEvent> {
//     return this.pageHideSubject.asObservable();
//   }

//   get pageShow$(): Observable<PageTransitionEvent> {
//     return this.pageShowSubject.asObservable();
//   }

//   get beforeUnload$(): Observable<BeforeUnloadEvent> {
//     return this.beforeUnloadSubject.asObservable();
//   }

//   get unload$(): Observable<Event> {
//     return this.unloadSubject.asObservable();
//   }
// }
