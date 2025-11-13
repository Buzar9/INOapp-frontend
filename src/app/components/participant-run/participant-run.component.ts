  import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
  import { interval, min, Subscription } from 'rxjs';

  import { CommonModule } from '@angular/common';
  import { ParticipantSendService } from '../../services/participant-send-service';
  import { NetworkService } from '../../services/request/NetworkService';
  import { ParticipantStateService } from '../../services/participant-state.service';
  import { Router } from '@angular/router';
  import { ParticipantMapComponent } from '../map/participant-map.component';
  import { ButtonModule } from 'primeng/button';
  import { RippleModule } from 'primeng/ripple';
  import { MessageModule } from 'primeng/message';
import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
import { AddControlPointRequest } from '../../services/request/AddControlPointRequest';

import { RunMetricAfterControlPoint } from '../../services/response/RunMetricAfterControlPoint';
import { Station } from '../../services/response/Station';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { TileDbService } from '../../services/tile-db.service';
import { ViewChild } from '@angular/core';
  
  @Component({
    selector: 'participant',
    standalone: true,
    imports: [CommonModule, ParticipantMapComponent, ButtonModule, RippleModule, MessageModule, QrScannerComponent],
    templateUrl: './participant-run.component.html',
    styleUrls: ['./participant-run.component.css']
  })
  export class ParticipantRunComponent implements OnInit, OnDestroy {
    @Output() 
    navigationRequested = new EventEmitter<void>();
    @ViewChild('mapComponent') mapComponent!: ParticipantMapComponent;

    stationsToShow: Station[] = []

  showScanner: boolean = false;
  wasRunActivate: boolean = false;
  isRunFinished: boolean = false;
  isPortraitMode: boolean = false;
  showOrientationWarning: boolean = true;    runStartTime: number = Number(this.getLocalStorageItem('runStartTime')) || 0;
    runFinishTime: number = Number(this.getLocalStorageItem('runStartTime')) || 0;
    raceTimeDisplay: string = '00:00';
    currentTime: string = '';

    checkpointsNumber: number = 0
  
    isOnline: boolean = navigator.onLine;
    // dodo mock
    // isOnline: boolean = true

    backgroundMap: BackgroundMap | null = null;
  
    private timerSubscription: Subscription = new Subscription();
  
    private subscriptions: Subscription = new Subscription();
  
  constructor(
    private router: Router, 
    private sendService: ParticipantSendService, 
    private participantStateService: ParticipantStateService, 
    private networkService: NetworkService,
    private tileDbService: TileDbService,
  ){}    ngOnInit(): void {
      let stationRequest = {
        categoryId: this.getLocalStorageItem('categoryId')
      }

      this.sendService.getStations(stationRequest).subscribe({
        next: (response) => {this.stationsToShow = response},
        error: (err) => console.log('dodo error', err)
      })

      let backgroundMapRequest = { 
        competitionId: 'Competition123',
        categoryId: this.getLocalStorageItem('categoryId')
      }

      this.sendService.getBackgroundMap(backgroundMapRequest).subscribe({
        next: (response) => this.backgroundMap = response,
        error: (err) => console.log('dodo error', err)
      })


      this.timerSubscription = interval(1000).subscribe(() => {
        const now = new Date();
        this.currentTime = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
        if (this.runStartTime > 0 && this.wasRunActivate) {
          const elapsed = Date.now() - this.runStartTime;
          this.raceTimeDisplay = this.formatTime(elapsed);
        }
      });
  
      this.networkService.getOnlineStatus().subscribe(status => {
        this.isOnline = status;
        this.retryPendingRequests()
      });

      this.checkOrientation();
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.checkOrientation(), 100);
      });
      window.addEventListener('resize', () => this.checkOrientation());
    }
  
    ngOnDestroy(): void {
      localStorage.clear()
      this.timerSubscription.unsubscribe();
      this.subscriptions.unsubscribe();
    }

    toggleScanner() {
      if (this.mapComponent) {
        this.mapComponent.hidePopups();
      }
      this.showScanner = !this.showScanner;
    }

    async receiveScan(scan: string) {
      const timestamp = new Date().getTime().toString();
      const location = await this.getLocationWithTimeout(5000) || {lat:"0.0", lng:"0.0", accuracy:"0.0"}
      let requestId = crypto.randomUUID()

      let request = {
        runId: this.getLocalStorageItem('runId'),
        stationId: scan,
        location: location,
        timestamp: timestamp.toString()
      }

      this.addRequestToSendingQueue(request, requestId)
      this.sendRequestDodo(request, requestId)

      this.showScanner = false;
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

  // dodo moze to powinno byc w send service? 
  private addRequestToSendingQueue(request: AddControlPointRequest, requestId: string): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    pendingRequests.push({ requestId, request });
    localStorage.setItem('pendingRequests', JSON.stringify(pendingRequests));
  }
  
  private sendRequestDodo(request: AddControlPointRequest, requestId: string) {
    this.sendService.addControlPoint(request).subscribe({
      next: (response) => {
        this.removePendingRequest(requestId)
        this.handleAddControlPointResponse(response)
      },
      error: (err) => {
        console.log('dodo nie udalo sie wyslac', err)
        this.removePendingRequest(requestId)
      }
    })
  }

  private removePendingRequest(requestId: string): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    const updatedRequests = pendingRequests.filter((req: any) => req.requestId !== requestId);
    localStorage.setItem('pendingRequests', JSON.stringify(updatedRequests));
  }

  private handleAddControlPointResponse(response: RunMetricAfterControlPoint) {
    this.setLocalStorageItem('runStartTime', `${response.startTime}`)
    this.runStartTime = response.startTime;

    if (response.checkpointsNumber != null) {
      this.checkpointsNumber = response.checkpointsNumber
    }

    if(response.mainTime != null || response.mainTime != undefined) {
      this.raceTimeDisplay = this.formatTime(response.mainTime); 
    }

    this.wasRunActivate = response.wasActivate;
    this.isRunFinished = response.isFinished
  }

// dodo kiedy tego uzyc
  private retryPendingRequests(): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    if (pendingRequests.length > 0) {
      pendingRequests.forEach((pending: any) => {
        this.sendRequestDodo(pending.request, pending.requestId);
      });
    }
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${this.pad(hours)}:${this.pad(minutes)}`;
  }
  
  private pad(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  } 

  private getLocalStorageItem(key: string): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key) || '';
    }
    return '';
  }
  
  private setLocalStorageItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  }

  async onNewRoute(): Promise<void> {
    this.runStartTime = 0;
    this.runFinishTime = 0;
    this.raceTimeDisplay = '00:00';
    this.wasRunActivate = true;
    localStorage.clear();
    this.participantStateService.clear();
    
    try {
      await this.tileDbService.clearAllMaps();
    } catch (error) {
      console.error('Błąd podczas usuwania map z IndexedDB:', error);
    }
    
    this.router.navigateByUrl('');
  }

  resetMapView() {
    if (this.mapComponent) {
      this.mapComponent.resetMapView();
    }
  }

  private checkOrientation(): void {
    const isPortrait = window.innerHeight > window.innerWidth;
    
    this.isPortraitMode = isPortrait;
    
    if (isPortrait) {
      this.showOrientationWarning = true;
    } else {
      this.showOrientationWarning = false;
    }
  }

  dismissOrientationWarning(): void {
    this.showOrientationWarning = false;
  }
}