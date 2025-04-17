// src/app/app.component.ts

// Helper functions
function getLocalStorageItem(key: string): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key) || '';
  }
  return '';
}

function setLocalStorageItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { StartScreenComponent } from '../start-screen/start-screen.component';
// import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
import { OrganizerResultsComponent } from '../organizer-results/organizer-results.component';
import { CommonModule } from '@angular/common';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
import { QrData } from '../../utils/QrData';
import { SendService } from '../../services/send-service';
import { HttpClientModule } from '@angular/common/http';
import { StartRunRequest } from '../../services/StartRunRequest';
import { AddCheckpointRequest } from '../../services/AddCheckpointRequest';
import { FinishRunRequest } from '../../services/FinishRunRequest';
import { AddPenaltyRequest } from '../../services/AddPenaltyRequest';
import { InitiateRunRequest } from '../../services/InitiateRunRequest';
import { NetworkService } from '../../services/NetworkService';
import { doc } from '@angular/fire/firestore';
// import { PageLifecycleService } from './page-lifecycle-service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, StartScreenComponent, QrScannerComponent, HttpClientModule],

  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent implements OnInit, OnDestroy {
  nickname: string = getLocalStorageItem('nickname');
  team: string = getLocalStorageItem('team');
  routeName: string = getLocalStorageItem('routeName');
  runStartTime: number = Number(getLocalStorageItem('runStartTime')) || 0;
  runFinishTime: string = '';
  raceTimeDisplay: string = getLocalStorageItem('raceTimeDisplay') || '00:00:00';
  currentTime: string = '';
  isRunFinished: boolean = Boolean(getLocalStorageItem('isRunFinished')) || false;
  // zmien na domysle false
  // isOrganizer: boolean = false;
  // dodo test
  runId: string = getLocalStorageItem('runId') || ''

  scanResultMessage: string = ''
  isScanResultVisible: boolean = false;

  currentPath: string = '';

  // isOnline: boolean = navigator.onLine;
  isOnline: boolean = true

  private timerSubscription: Subscription = new Subscription();
  // Store the bound event handler so that removal works correctly.
  private visibilityHandler = this.handleVisibilityChange.bind(this);

  private subscriptions: Subscription = new Subscription();

  constructor(private sendService: SendService, private router: Router, private networkService: NetworkService,
    // private pageLifecycleService: PageLifecycleService
  ){
    this.router.events.subscribe(() => {
      this.currentPath = this.router.url;
    })
  }

  ngOnInit(): void {
    // Start timer to update current time and race time
    this.timerSubscription = interval(1000).subscribe(() => {
      const now = new Date();
      this.currentTime = now.toLocaleTimeString();
      if (this.runStartTime > 0 && !this.isRunFinished) {
        const elapsed = Date.now() - this.runStartTime;
        this.raceTimeDisplay = this.formatTime(elapsed);
      }
    });

    this.networkService.getOnlineStatus(). subscribe(status => {
      this.isOnline = status;
      this.retryPendingRequests()
    });

    // Add visibilitychange event listener if document is available
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

// dodo do eksperymentow

    // this.subscriptions.add(
    //   this.pageLifecycleService.pageHide$.subscribe(event => {
    //     console.log('Strona stała się niewidoczna (pagehide):', event);
    //     // Możesz tutaj wykonać dodatkowe akcje – np. zatrzymać odtwarzanie mediów, zapisać stan aplikacji, itp.
    //   })
    // );

    // // Subskrypcja zdarzenia pageshow
    // this.subscriptions.add(
    //   this.pageLifecycleService.pageShow$.subscribe(event => {
    //     console.log('Strona ponownie widoczna (pageshow):', event);
    //     // Możesz przywrócić stan aplikacji lub wznowić działania.
    //   })
    // );

    // // Subskrypcja zdarzenia beforeunload
    // this.subscriptions.add(
    //   this.pageLifecycleService.beforeUnload$.subscribe(event => {
    //     console.log('Próba opuszczenia strony (beforeunload):', event);
    //     // Użytkownik otrzyma komunikat potwierdzenia opuszczenia, jeśli przeglądarka to umożliwia.
    //   })
    // );

    // // Subskrypcja zdarzenia unload
    // this.subscriptions.add(
    //   this.pageLifecycleService.unload$.subscribe(event => {
    //     console.log('Strona jest opuszczana (unload):', event);
    //     // W tym miejscu można wykonać operacje sprzątające, choć nie ma gwarancji, że asynchroniczne operacje się zakończą.
    //   })
    // );
  }

  ngOnDestroy(): void {
    // dodo obsluga zainicjalizowanych, ale nie wystartowanych biegow
    this.runFinishTime = this.raceTimeDisplay
    localStorage.clear
    this.timerSubscription.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }




    this.subscriptions.unsubscribe();
  }

  isOrganizer(): boolean {
    return this.currentPath.includes('organizer')
  }

  onUserSignUp(data: { nickname: string, team: string, routeName: string, competitionCategory: string }): void {
    this.nickname = data.nickname;
    this.team = data.team;
    this.routeName = data.routeName;
    this.runId = crypto.randomUUID()
    setLocalStorageItem('nickname', this.nickname);
    setLocalStorageItem('team', this.team);
    setLocalStorageItem('routeName', this.routeName);
    setLocalStorageItem('runId', this.runId);

    let initiateRequest = {
      runId: this.runId,
      routeName: this.routeName,
      competitionCategory: data.competitionCategory,
      nickname: this.nickname,
      team: this.team
    }
    this.sendRequest("INITIATE_RUN", initiateRequest, crypto.randomUUID())
  }

  async receiveQrData(qrData: QrData) {
    const timestamp = new Date().getTime().toString();
    const location = await this.getLocationWithTimeout(5000) || {lat:0.0, lng:0.0, accuracy:0.0}
    let requestId = crypto.randomUUID()

    switch (qrData.type) {
      case 'START_RUN':
        // dodo jak dwa razy zeskanuje to sie resetuje zegar
        const startTime = Date.now();
        this.runStartTime = startTime;
        localStorage.setItem('runStartTime', startTime.toString());

        let startRunRequest = {
          runId: this.runId,
          location: location,
          timestamp: timestamp
        };
        this.addRequestToSendingQueue("START_RUN", startRunRequest, requestId)
        this.sendRequest("START_RUN", startRunRequest, requestId)

        this.showMessage(`Powodzenia na trasie ${this.routeName}`)

        break;
      
      case 'CHECKPOINT':
        if(!qrData.id) {
          throw new Error('dodo checkpointId is null error')
        }

        let addCheckpointRequest = {
          runId: this.runId,
          checkpointId: qrData.id,
          routeName: this.routeName,
          location: location,
          timestamp: timestamp,
        }
        this.addRequestToSendingQueue("CHECKPOINT", addCheckpointRequest, requestId)
        this.sendRequest("CHECKPOINT", addCheckpointRequest, requestId)
  
        // dodo dopiero jak bedzie wyslane z powodzeniem
        this.showMessage(`Poprawnie zeskanowano punkt ${qrData.routeName} - ${qrData.id}`)

        break;
        
      case 'FINISH_RUN':
        const finishTime = Date.now();
        this.isRunFinished = true;
        localStorage.setItem('runFinishTime', finishTime.toString());
        localStorage.setItem('isRunFinished', 'true');
      
        const elapsed = finishTime - this.runStartTime;
        this.raceTimeDisplay = this.formatTime(elapsed);
        localStorage.setItem('raceTimeDisplay', this.raceTimeDisplay);   
  
        this.retryPendingRequests()

        let finishRunRequest = {
          runId: this.runId,
          location: location,
          timestamp: timestamp,
        }
        this.addRequestToSendingQueue("FINISH_RUN", finishRunRequest, requestId)
        this.sendRequest("FINISH_RUN", finishRunRequest, requestId)

        break;
    }
  }

private getLocationWithTimeout(timeout: number): Promise<{ lat: string, lng: string, accuracy: string } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      console.error('Geolokalizacja nie jest obsługiwana przez tę przeglądarkę.');
      return resolve(null);
    }
    
    const timer = setTimeout(() => {
      console.warn('Geolokalizacja - timeout');
      resolve(null);
    }, timeout);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({
          lat: position.coords.latitude.toString(),
          lng: position.coords.longitude.toString(),
          accuracy: position.coords.accuracy.toString()
        });
      },
      (error) => {
        clearTimeout(timer);
        console.error('Błąd pobierania lokalizacji:', error);
        resolve(null);
      },
      { enableHighAccuracy: true }
    );
  });
}

  handleVisibilityChange(): void {
    if(document.hidden) {
      console.log("hidden")
    }




    if (document.hidden && this.runStartTime > 0 && !this.isRunFinished) {
      // chyba dziala
      console.log('dodo penalty')
    }
  }

  formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;
  }
  
  onNewRoute(): void {
       this.nickname = '';
       this.routeName = '';
       this.runStartTime = 0;
       this.runFinishTime = '';
       this.raceTimeDisplay = '00:00:00';
       this.isRunFinished = false;
       localStorage.clear();
     }

  pad(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  }

  showMessage(message: string): void {
    this.scanResultMessage = message;
    this.isScanResultVisible = true;

    setTimeout(() => {
      this.isScanResultVisible = false;
      this.scanResultMessage = '';
    }, 7000)
  }






  private addRequestToSendingQueue(key: string, request: any, requestId: string): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    pendingRequests.push({ requestId, key, request });
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
  }

  private retryPendingRequests(): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    if (pendingRequests.length > 0) {
      pendingRequests.forEach((pending: any) => {
        this.sendRequest(pending.key, pending.request, pending.requestId);
      });
    }
  }

  private removePendingRequest(requestId: string): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    const updatedRequests = pendingRequests.filter((req: any) => req.requestId !== requestId);
    localStorage.setItem('pendingRequests', JSON.stringify(updatedRequests));
  }

  // Metoda wysyłania zapytań z dodanym identyfikatorem zapytania
  private sendRequest(key: string, request: any, requestId: string): void {
    console.log(request)
    switch (key) {
      case 'INITIATE_RUN':
        this.sendService.initiateRun(request).subscribe({
              next: (response) => {
                console.log('Sukces: Wysłano start run', response);
            this.removePendingRequest(requestId); // Usuwamy zapytanie po pomyślnym wysłaniu
              },
              error: (err) => console.log('dodo error', err)
            });
        break;
      case 'START_RUN':
        this.sendService.startRun(request).subscribe({
          next: (response) => {
            console.log('Sukces: Wysłano start run', response);
            this.removePendingRequest(requestId); // Usuwamy zapytanie po pomyślnym wysłaniu
          },
          error: (err) => {
            console.error('Błąd: Nie udało się wysłać start run', err);
          }
        });
        break;
      case 'CHECKPOINT':
        this.sendService.addCheckpoint(request).subscribe({
          next: (response) => {
            console.log('Sukces: Wysłano checkpoint', response);
            this.removePendingRequest(requestId); // Usuwamy zapytanie po pomyślnym wysłaniu
          },
          error: (err) => {
            console.error('Błąd: Nie udało się wysłać checkpoint', err);
          }
        });
        break;
      case 'FINISH_RUN':
        this.sendService.finishRun(request).subscribe({
          next: (response) => {
            console.log('Sukces: Wysłano finish run', response);
            this.removePendingRequest(requestId); // Usuwamy zapytanie po pomyślnym wysłaniu
          },
          error: (err) => {
            console.error('Błąd: Nie udało się wysłać finish run', err);
          }
        });
        break;
    }
  }
}