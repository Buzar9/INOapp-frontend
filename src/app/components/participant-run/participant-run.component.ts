  import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
  import { interval, Subscription } from 'rxjs';

  import { CommonModule } from '@angular/common';
  import { ParticipantSendService } from '../../services/participant-send-service';
  import { NetworkService } from '../../services/request/NetworkService';
  import { ParticipantStateService } from '../../services/participant-state.service';
  import { Router } from '@angular/router';
  import { ParticipantMapComponent } from '../map/participant-map.component';
  import { ButtonModule } from 'primeng/button';
  import { RippleModule } from 'primeng/ripple';
  import { MessageModule } from 'primeng/message';
  import { ProgressSpinnerModule } from 'primeng/progressspinner';
  import { QrScannerComponent } from '../qr-scanner/qr-scanner.component';
  import { AddControlPointRequest } from '../../services/request/AddControlPointRequest';

  import { RunMetricAfterControlPoint } from '../../services/response/RunMetricAfterControlPoint';
  import { Station } from '../../services/response/Station';
  import { BackgroundMap } from '../../services/response/BackgroundMap';
  import { TileDbService } from '../../services/tile-db.service';
  import { ViewChild } from '@angular/core';
  import { GpsTrackingService } from '../../services/gps-tracking.service';
  import { BatteryService } from '../../services/battery.service';
  import { TrackingMode, TRACKING_CONFIGS } from '../../models/gps-track.model';
  import { DialogModule } from 'primeng/dialog';
  import { FormsModule } from '@angular/forms';
  import { InputSwitchModule } from 'primeng/inputswitch';
  import { DropdownModule } from 'primeng/dropdown';
  import { TrackingModeService } from '../../services/tracking-mode.service';
  import { TrackingModeComponent } from '../tracking-mode/tracking-mode.component';

  @Component({
    selector: 'participant',
    standalone: true,
    imports: [CommonModule, ParticipantMapComponent, ButtonModule, RippleModule, MessageModule, ProgressSpinnerModule, QrScannerComponent, DialogModule, FormsModule, InputSwitchModule, DropdownModule, TrackingModeComponent],
    templateUrl: './participant-run.component.html',
    styleUrls: ['./participant-run.component.css']
  })
  export class ParticipantRunComponent implements OnInit, OnDestroy {
    @Output()
    navigationRequested = new EventEmitter<void>();
    @ViewChild('mapComponent') mapComponent!: ParticipantMapComponent;

    stationsToShow: Station[] = []

    showScanner: boolean = false;
    isScanning: boolean = false;
    wasRunActivate: boolean = false;
    isRunFinished: boolean = false;
    runStartTime: number = Number(this.getLocalStorageItem('runStartTime')) || 0;
    runFinishTime: number = Number(this.getLocalStorageItem('runStartTime')) || 0;
    raceTimeDisplay: string = '00:00';
    currentTime: string = '';

    checkpointsNumber: number = Number(this.getLocalStorageItem('checkpointsNumber')) || 0;

    isOnline: boolean = navigator.onLine;

    backgroundMap: BackgroundMap | null = null;

    // GPS Tracking
    showMenu: boolean = false;
    showGpsSettings: boolean = false;
    gpsTrackingEnabled: boolean = false;
    currentGpsMode: TrackingMode = TrackingMode.AUTO;
    batteryLevel: number = 100;
    autoAdjustEnabled: boolean = true;
    TrackingMode = TrackingMode;
    TRACKING_CONFIGS = TRACKING_CONFIGS;

    // Tracking Mode (power saving) - ultra minimized state
    isInTrackingMode: boolean = false;
    showTrackingModeInfo: boolean = false;

    // Auto Screen Dimming settings (auto-activate tracking mode after inactivity)
    autoTrackingModeEnabled: boolean = false;
    autoTrackingModeDelay: number = 60; // seconds (default 1 minute)
    private inactivityTimer: any = null;
    private lastInteractionTime: number = Date.now();

    // Dialog-specific auto-dimming settings (initialized with default enabled)
    dialogAutoTrackingEnabled: boolean = true; // Enabled by default in dialog
    dialogAutoTrackingDelay: number = 60; // seconds (default 1 minute)

    private timerSubscription: Subscription = new Subscription();

    private subscriptions: Subscription = new Subscription();

  constructor(
    private router: Router,
    private sendService: ParticipantSendService,
    private participantStateService: ParticipantStateService,
    private networkService: NetworkService,
    private tileDbService: TileDbService,
    private gpsTrackingService: GpsTrackingService,
    private batteryService: BatteryService,
    private trackingModeService: TrackingModeService
  ){}

    async ngOnInit(): Promise<void> {
      const runId = this.getLocalStorageItem('runId');

      if (runId) {
        const savedWasRunActivate = this.getLocalStorageItem('wasRunActivate');
        const savedIsRunFinished = this.getLocalStorageItem('isRunFinished');
        const savedRaceTimeDisplay = this.getLocalStorageItem('raceTimeDisplay');

        if (savedWasRunActivate === 'true') {
          this.wasRunActivate = true;
        }
        if (savedIsRunFinished === 'true') {
          this.isRunFinished = true;
        }
        if (savedRaceTimeDisplay) {
          this.raceTimeDisplay = savedRaceTimeDisplay;
        }

        this.participantStateService.restoreFromLocalStorage();
      } else {
        try {
          const sessionBackup = await this.tileDbService.getParticipantSession();
          if (sessionBackup) {
            this.setLocalStorageItem('runId', sessionBackup.runId);
            this.setLocalStorageItem('categoryId', sessionBackup.categoryId);
            this.setLocalStorageItem('competitionId', sessionBackup.competitionId);
            this.setLocalStorageItem('participantUnit', sessionBackup.participantUnit);
            this.setLocalStorageItem('participantName', sessionBackup.participantName);
            this.setLocalStorageItem('wasRunActivate', String(sessionBackup.wasRunActivate));
            this.setLocalStorageItem('isRunFinished', String(sessionBackup.isRunFinished));
            this.setLocalStorageItem('runStartTime', String(sessionBackup.runStartTime));
            this.setLocalStorageItem('raceTimeDisplay', sessionBackup.raceTimeDisplay);
            this.setLocalStorageItem('checkpointsNumber', String(sessionBackup.checkpointsNumber));
            this.setLocalStorageItem('pendingRequests', JSON.stringify(sessionBackup.pendingRequests));

            this.wasRunActivate = sessionBackup.wasRunActivate;
            this.isRunFinished = sessionBackup.isRunFinished;
            this.runStartTime = sessionBackup.runStartTime;
            this.raceTimeDisplay = sessionBackup.raceTimeDisplay;
            this.checkpointsNumber = sessionBackup.checkpointsNumber;

            // Przywróć do serwisu
            this.participantStateService.setRunId(sessionBackup.runId);
            this.participantStateService.setOrganizationData({
              competitionId: sessionBackup.competitionId,
              participantUnit: sessionBackup.participantUnit,
              categoryId: sessionBackup.categoryId
            });
            this.participantStateService.setParticipantName({ participantName: sessionBackup.participantName });

            // Przywróć GPS tracking jeśli był aktywny
            if (sessionBackup.wasRunActivate && !sessionBackup.isRunFinished && sessionBackup.gpsTrackingEnabled) {
              console.log('[ParticipantRun] Restoring GPS tracking from session backup');
              if (sessionBackup.gpsTrackingMode) {
                this.currentGpsMode = sessionBackup.gpsTrackingMode as TrackingMode;
              }
              // Tracking zostanie wystartowany w initGpsTracking po załadowaniu preferencji
              setTimeout(async () => {
                if (this.currentGpsMode !== TrackingMode.OFF) {
                  await this.gpsTrackingService.startTracking(sessionBackup.runId);
                }
              }, 1000);
            }
          } else {
            console.log('[ParticipantRun] No session backup found - starting fresh');
          }
        } catch (err) {
          console.error('[ParticipantRun] Error restoring session from IndexedDB:', err);
        }
      }

      // Pobierz stanowiska tylko jeśli bieg już był aktywowany (przywracanie sesji)
      if (this.wasRunActivate) {
        this.loadStations();
      }

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
        this.currentTime = now.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
        if (this.runStartTime > 0 && this.wasRunActivate && !this.isRunFinished) {
          const elapsed = Date.now() - this.runStartTime;
          this.raceTimeDisplay = this.formatTime(elapsed);
        }

        // Update tracking mode data if active
        if (this.isInTrackingMode) {
          this.updateTrackingModeData();
        }
      });

      this.networkService.getOnlineStatus().subscribe(status => {
        this.isOnline = status;
        this.retryPendingRequests()
      });

      // Visibility change listener for Wake Lock reacquisition
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

      // Inicjalizacja GPS tracking
      this.initGpsTracking();
    }

    ngOnDestroy(): void {
      this.timerSubscription.unsubscribe();
      this.subscriptions.unsubscribe();

      // Stop GPS tracking
      if (this.gpsTrackingEnabled) {
        this.gpsTrackingService.stopTracking();
      }

      // Exit tracking mode if active
      if (this.isInTrackingMode) {
        this.exitTrackingMode();
      }
    }

    toggleScanner() {
      if (this.mapComponent) {
        this.mapComponent.hidePopups();
      }
      this.showScanner = !this.showScanner;
    }

    async receiveScan(scan: string) {
      this.showScanner = false;
      this.isScanning = true;

      const timestamp = new Date().getTime().toString();
      const location = await this.getLocationWithTimeout(10000) || this.getFallbackLocation()
      let requestId = crypto.randomUUID()

      let request = {
        runId: this.getLocalStorageItem('runId'),
        stationId: scan,
        location: location,
        timestamp: timestamp.toString()
      }

      this.addRequestToSendingQueue(request, requestId)
      this.sendRequestDodo(request, requestId)
    }

  private getLocationWithTimeout(timeout: number): Promise<{ lat: string, lng: string, accuracy: string } | null> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        console.error('Geolokalizacja nie jest obsługiwana przez tę przeglądarkę.');
        return resolve(null);
      }

      const timer = setTimeout(() => {
        console.log('[ParticipantRun] Geolokalizacja - timeout, using fallback location');
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
          console.error('[ParticipantRun] Błąd pobierania lokalizacji:', error);
          resolve(null);
        },
        { enableHighAccuracy: true }
      );
    });
  }

  private getFallbackLocation(): { lat: string, lng: string, accuracy: string } {
    // Spróbuj użyć ostatniej znanej pozycji z GPS tracking service
    const lastPosition = this.gpsTrackingService.getLastPosition();
    if (lastPosition) {
      console.log('[ParticipantRun] Using last known position from GPS tracking');
      return {
        lat: lastPosition.coords.latitude.toString(),
        lng: lastPosition.coords.longitude.toString(),
        accuracy: lastPosition.coords.accuracy.toString()
      };
    }

    // Jeśli GPS tracking nie ma pozycji, zwróć domyślną
    console.warn('[ParticipantRun] No GPS position available, using default location (0,0)');
    return { lat: "0.0", lng: "0.0", accuracy: "0.0" };
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
        this.isScanning = false;
      },
      error: (err) => {
        console.log('dodo nie udalo sie wyslac', err)
        this.removePendingRequest(requestId)
        this.isScanning = false;
      }
    })
  }

  private removePendingRequest(requestId: string): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');
    const updatedRequests = pendingRequests.filter((req: any) => req.requestId !== requestId);
    localStorage.setItem('pendingRequests', JSON.stringify(updatedRequests));
  }

  private loadStations(): void {
    const stationRequest = {
      categoryId: this.getLocalStorageItem('categoryId')
    };

    this.sendService.getStations(stationRequest).subscribe({
      next: (response) => {
        this.stationsToShow = response;
        console.log('dodo stacje', response);
      },
      error: (err) => console.log('dodo error', err)
    });
  }

  private async handleAddControlPointResponse(response: RunMetricAfterControlPoint) {
    this.setLocalStorageItem('runStartTime', `${response.startTime}`)
    this.runStartTime = response.startTime;

    if (response.checkpointsNumber != null) {
      this.checkpointsNumber = response.checkpointsNumber
      this.setLocalStorageItem('checkpointsNumber', `${response.checkpointsNumber}`)
    }

    if(response.mainTime != null || response.mainTime != undefined) {
      this.raceTimeDisplay = this.formatTime(response.mainTime);
      this.setLocalStorageItem('raceTimeDisplay', this.raceTimeDisplay)
    }

    const wasActiveBefore = this.wasRunActivate;
    this.wasRunActivate = response.wasActivate;
    this.setLocalStorageItem('wasRunActivate', `${response.wasActivate}`)

    const wasFinishedBefore = this.isRunFinished;
    this.isRunFinished = response.isFinished
    this.setLocalStorageItem('isRunFinished', `${response.isFinished}`)

    // Start GPS tracking i pobierz stanowiska gdy bieg się rozpoczyna
    if (!wasActiveBefore && response.wasActivate) {
      // Pobierz stanowiska po aktywacji biegu
      this.loadStations();

      const runId = this.getLocalStorageItem('runId');
      console.log('[ParticipantRun] Run activated. RunId:', runId, 'GPS Mode:', this.currentGpsMode);

      if (runId) {
        console.log('[ParticipantRun] Starting GPS tracking for run:', runId);
        try {
          await this.gpsTrackingService.startTracking(runId);
          console.log('[ParticipantRun] GPS tracking started successfully');
        } catch (error) {
          console.error('[ParticipantRun] Failed to start GPS tracking:', error);
        }
      }

      // Start auto screen dimming timer if enabled
      if (this.autoTrackingModeEnabled) {
        this.startInactivityTimer();
        console.log('[ParticipantRun] Auto screen dimming timer started');
      }
    }

    // Stop GPS tracking gdy bieg się kończy
    if (!wasFinishedBefore && response.isFinished) {
      console.log('[ParticipantRun] Run finished, stopping GPS tracking');
      await this.gpsTrackingService.stopTracking();

      // Clear auto tracking timer
      this.clearInactivityTimer();

      console.log('[ParticipantRun] GPS tracking stopped');

      // Pobierz i wyświetl trasę GPS z backendu
      const runId = this.getLocalStorageItem('runId');
      if (runId) {
        await this.loadAndDisplayGpsTrack(runId);
      }

      // Wyczyść lokalne punkty GPS z IndexedDB (są już na backendzie)
      try {
        await this.gpsTrackingService.clearAllTrackPoints();
        console.log('[ParticipantRun] Local GPS points cleared from IndexedDB');
      } catch (error) {
        console.error('[ParticipantRun] Error clearing local GPS points:', error);
      }

      // Wyczyść preferencje GPS z localStorage (reset do domyślnych przy następnym biegu)
      localStorage.removeItem('gps-tracking-preferences');
      console.log('[ParticipantRun] GPS preferences cleared from localStorage');
    }

    // Zapisz backup stanu do IndexedDB po każdej zmianie
    this.saveSessionBackup();
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

  private clearRunData(): void {
    const keysToRemove = ['wasRunActivate', 'isRunFinished', 'raceTimeDisplay', 'runStartTime', 'checkpointsNumber', 'pendingRequests'];
    keysToRemove.forEach(key => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    });

    this.runStartTime = 0;
    this.runFinishTime = 0;
    this.raceTimeDisplay = '00:00';
    this.checkpointsNumber = 0;
    this.wasRunActivate = false;
    this.isRunFinished = false;
  }

  async onNewRoute(): Promise<void> {
    this.router.navigateByUrl('').then(async () => {
      const runId = this.getLocalStorageItem('runId');

      // Stop GPS tracking
      if (this.gpsTrackingEnabled) {
        await this.gpsTrackingService.stopTracking();
      }

      // Usuń GPS track points
      try {
        await this.gpsTrackingService.clearAllTrackPoints();
      } catch (error) {
        console.error('[ParticipantRun] Error clearing GPS track:', error);
      }

      this.runStartTime = 0;
      this.runFinishTime = 0;
      this.raceTimeDisplay = '00:00';
      this.checkpointsNumber = 0;
      this.wasRunActivate = false;
      this.isRunFinished = false;
      this.showScanner = false;
      this.isScanning = false;

      this.stationsToShow = [];
      this.backgroundMap = null;

      localStorage.clear();
      this.participantStateService.clear();

      // Usuń backup sesji z IndexedDB
      try {
        await this.tileDbService.clearParticipantSession();
      } catch (error) {
        console.error('[ParticipantRun] Error clearing session backup:', error);
      }

      // Usuń mapy z IndexedDB
      this.tileDbService.clearAllMaps().catch(error => {
        console.error('[ParticipantRun] Error clearing maps from IndexedDB:', error);
      });
    });
  }

  resetMapView() {
    if (this.mapComponent) {
      this.mapComponent.resetMapView();
    }
  }

  highlightStations(): void {
    if (this.mapComponent) {
      this.mapComponent.pulseStations();
    }
  }

  /**
   * Zapisuje backup stanu sesji do IndexedDB.
   * Wywoływane po każdej istotnej zmianie stanu (skanowanie checkpointu, rozpoczęcie biegu itp.)
   */
  private saveSessionBackup(): void {
    const pendingRequests = JSON.parse(localStorage.getItem('pendingRequests') || '[]');

    const sessionState = {
      runId: this.getLocalStorageItem('runId'),
      categoryId: this.getLocalStorageItem('categoryId'),
      competitionId: this.participantStateService.competitionId,
      participantUnit: this.participantStateService.participantUnit,
      participantName: this.participantStateService.participantName,
      wasRunActivate: this.wasRunActivate,
      isRunFinished: this.isRunFinished,
      runStartTime: this.runStartTime,
      raceTimeDisplay: this.raceTimeDisplay,
      checkpointsNumber: this.checkpointsNumber,
      pendingRequests: pendingRequests,
      gpsTrackingEnabled: this.gpsTrackingEnabled,
      gpsTrackingMode: this.currentGpsMode
    };

    this.tileDbService.saveParticipantSession(sessionState).catch(err => {
      console.error('[ParticipantRun] Error saving session backup to IndexedDB:', err);
    });
  }

  /**
   * GPS TRACKING METHODS
   */

  private initGpsTracking(): void {
    // Wczytaj preferencje GPS
    const preferences = this.gpsTrackingService.getPreferences();
    this.currentGpsMode = preferences.mode;
    this.autoAdjustEnabled = preferences.autoAdjustOnLowBattery;

    // Subskrybuj status trackingu
    this.subscriptions.add(
      this.gpsTrackingService.isTracking().subscribe(tracking => {
        this.gpsTrackingEnabled = tracking;
      })
    );

    // Subskrybuj tryb trackingu
    this.subscriptions.add(
      this.gpsTrackingService.getCurrentMode().subscribe(mode => {
        this.currentGpsMode = mode;
      })
    );

    // Subskrybuj status baterii i automatycznie dostosuj tryb GPS jeśli AUTO
    this.subscriptions.add(
      this.batteryService.getBatteryStatus().subscribe(status => {
        const previousBatteryLevel = this.batteryLevel;
        this.batteryLevel = status.levelPercentage;
        
        // Auto-adjust GPS mode based on battery level when in AUTO mode
        if (this.currentGpsMode === TrackingMode.AUTO && this.gpsTrackingEnabled) {
          this.autoAdjustGpsMode(status.levelPercentage, previousBatteryLevel);
        }
      })
    );
  }

  // Przechowuje aktualny efektywny tryb GPS w trybie AUTO
  private effectiveGpsMode: TrackingMode = TrackingMode.HIGH;

  /**
   * Automatycznie dostosowuje tryb GPS na podstawie poziomu baterii
   */
  private autoAdjustGpsMode(batteryLevel: number, previousBatteryLevel: number): void {
    let newEffectiveMode: TrackingMode;
    
    if (batteryLevel > 50) {
      newEffectiveMode = TrackingMode.HIGH;
    } else if (batteryLevel > 30) {
      newEffectiveMode = TrackingMode.MEDIUM;
    } else if (batteryLevel > 15) {
      newEffectiveMode = TrackingMode.LOW;
    } else {
      // Poniżej 15% - nadal śledzimy ale oszczędnie
      newEffectiveMode = TrackingMode.LOW;
    }
    
    // Zmień tylko jeśli efektywny tryb się zmienił
    if (newEffectiveMode !== this.effectiveGpsMode) {
      this.effectiveGpsMode = newEffectiveMode;
      // Użyj wewnętrznej metody serwisu do zmiany konfiguracji bez nadpisywania preferencji
      this.gpsTrackingService.applyEffectiveConfig(newEffectiveMode);
      console.log(`[ParticipantRun] Auto GPS adjust: battery ${batteryLevel}% -> effective mode: ${newEffectiveMode}`);
    }
  }

  toggleMenu(): void {
    this.showMenu = !this.showMenu;
  }

  toggleGpsSettings(): void {
    this.showGpsSettings = !this.showGpsSettings;
    this.showMenu = false;
  }

  async onGpsModeChange(mode: TrackingMode): Promise<void> {
    if (mode === TrackingMode.OFF && this.gpsTrackingEnabled) {
      // Potwierdzenie wyłączenia
      const preferences = this.gpsTrackingService.getPreferences();
      if (preferences.warnBeforeDisabling) {
        // W produkcji użyj PrimeNG ConfirmDialog
        const confirmed = confirm('Wyłączenie trackingu GPS uniemożliwi wyświetlenie szczegółowej trasy po zakończeniu biegu. Kontynuować?');
        if (!confirmed) {
          return;
        }
      }
    }

    await this.gpsTrackingService.changeTrackingMode(mode);
    this.currentGpsMode = mode;
    this.savePreferencesAndBackup();
  }

  getModeLabel(mode: TrackingMode): string {
    switch (mode) {
      case TrackingMode.AUTO: return 'Auto';
      case TrackingMode.OFF: return 'Wyłączony';
      case TrackingMode.LOW: return 'Oszczędny';
      case TrackingMode.MEDIUM: return 'Zbalansowany';
      case TrackingMode.HIGH: return 'Dokładny';
      case TrackingMode.MAX: return 'Maksymalny';
      default: return '';
    }
  }

  getModeDescription(mode: TrackingMode): string {
    return TRACKING_CONFIGS[mode].description;
  }

  onAutoAdjustChange(): void {
    const preferences = this.gpsTrackingService.getPreferences();
    preferences.autoAdjustOnLowBattery = this.autoAdjustEnabled;
    this.gpsTrackingService.savePreferences(preferences);
  }

  private savePreferencesAndBackup(): void {
    this.saveSessionBackup();
  }

  private async loadAndDisplayGpsTrack(runId: string): Promise<void> {
    try {
      console.log('[ParticipantRun] Loading GPS track for runId:', runId);
      const trackResponse = await new Promise<any>((resolve, reject) => {
        this.sendService.getGpsTrack(runId).subscribe({
          next: (response) => resolve(response),
          error: (error) => reject(error)
        });
      });

      if (!trackResponse || !trackResponse.segments || trackResponse.segments.length === 0) {
        console.log('[ParticipantRun] No GPS track data available');
        return;
      }

      console.log('[ParticipantRun] GPS track loaded:', trackResponse);

      // Wyświetl trasę na mapie
      this.displayGpsTrackOnMap(trackResponse);
    } catch (error) {
      console.error('[ParticipantRun] Failed to load GPS track:', error);
    }
  }

  private displayGpsTrackOnMap(trackResponse: any): void {
    if (!this.mapComponent) {
      console.error('[ParticipantRun] Map component not available');
      return;
    }

    console.log('[ParticipantRun] Displaying GPS track with', trackResponse.segments.length, 'segments');

    // Deleguj wyświetlanie do komponentu mapy
    this.mapComponent.displayGpsTrack(trackResponse.segments, trackResponse.stats);
  }

  // ============================================
  // TRACKING MODE (Power Saving) Methods
  // ============================================

  /**
   * Toggle tracking mode (power saving mode with black screen)
   */
  async toggleTrackingMode(): Promise<void> {
    if (this.isInTrackingMode) {
      await this.exitTrackingMode();
    } else {
      await this.enterTrackingMode();
    }
  }

  /**
   * Enter tracking mode (black screen, Wake Lock, GPS optimization)
   */
  async enterTrackingMode(): Promise<void> {
    console.log('[ParticipantRun] Entering tracking mode');

    // Show info dialog first time
    const hasSeenInfo = localStorage.getItem('trackingModeInfoSeen');
    if (!hasSeenInfo) {
      this.showTrackingModeInfo = true;
      return; // Wait for user to confirm
    }

    await this.activateTrackingMode();
  }

  /**
   * Actually activate tracking mode (called after info dialog or directly)
   */
  async activateTrackingMode(): Promise<void> {
    try {
      // Enable Wake Lock
      const wakeLockEnabled = await this.trackingModeService.enableTrackingMode();
      if (!wakeLockEnabled) {
        console.warn('[ParticipantRun] Wake Lock not enabled, but continuing');
      }

      // Optimize GPS for battery saving
      await this.gpsTrackingService.optimizeForTrackingMode();

      // Set tracking mode flag
      this.isInTrackingMode = true;

      // Close menu
      this.showMenu = false;

      console.log('[ParticipantRun] Tracking mode activated');
    } catch (error) {
      console.error('[ParticipantRun] Failed to enter tracking mode:', error);
    }
  }

  /**
   * Exit tracking mode and restore normal view
   */
  async exitTrackingMode(): Promise<void> {
    console.log('[ParticipantRun] Exiting tracking mode');

    try {
      // Disable Wake Lock
      await this.trackingModeService.disableTrackingMode();

      // Restore original GPS mode
      await this.gpsTrackingService.restoreOriginalMode();

      // Clear tracking mode flag
      this.isInTrackingMode = false;

      // Restart inactivity timer if auto mode is enabled
      if (this.autoTrackingModeEnabled && this.wasRunActivate && !this.isRunFinished) {
        this.resetInactivityTimer();
      }

      console.log('[ParticipantRun] Tracking mode deactivated');
    } catch (error) {
      console.error('[ParticipantRun] Failed to exit tracking mode:', error);
    }
  }

  /**
   * Start inactivity timer for auto screen dimming
   */
  private startInactivityTimer(): void {
    if (!this.autoTrackingModeEnabled || this.isInTrackingMode) {
      return;
    }

    this.clearInactivityTimer();

    console.log(`[ParticipantRun] Starting auto-dimming timer: ${this.autoTrackingModeDelay}s`);

    this.inactivityTimer = setTimeout(async () => {
      if (!this.isInTrackingMode && this.wasRunActivate && !this.isRunFinished) {
        console.log('[ParticipantRun] Auto-dimming screen after inactivity');
        await this.enterTrackingMode();
      }
    }, this.autoTrackingModeDelay * 1000);
  }

  /**
   * Reset inactivity timer (called on user interaction)
   */
  private resetInactivityTimer(): void {
    this.lastInteractionTime = Date.now();
    this.startInactivityTimer();
  }

  /**
   * Clear inactivity timer
   */
  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Toggle auto screen dimming (auto-activate tracking mode after inactivity)
   */
  toggleAutoTrackingMode(): void {
    this.autoTrackingModeEnabled = !this.autoTrackingModeEnabled;

    if (this.autoTrackingModeEnabled && !this.isInTrackingMode && this.wasRunActivate && !this.isRunFinished) {
      this.startInactivityTimer();
    } else {
      this.clearInactivityTimer();
    }

    console.log(`[ParticipantRun] Auto screen dimming: ${this.autoTrackingModeEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Change auto screen dimming delay
   */
  changeAutoTrackingDelay(seconds: number): void {
    this.autoTrackingModeDelay = seconds;

    // Restart timer with new delay if enabled
    if (this.autoTrackingModeEnabled && !this.isInTrackingMode) {
      this.resetInactivityTimer();
    }

    console.log(`[ParticipantRun] Auto dimming delay changed to: ${seconds}s`);
  }

  /**
   * Handle auto-wygaszanie dropdown change (0 = disabled, >0 = enabled with delay)
   */
  onAutoWygaszanieChange(seconds: number): void {
    if (seconds === 0) {
      // Disable auto screen dimming
      this.autoTrackingModeEnabled = false;
      this.clearInactivityTimer();
      console.log('[ParticipantRun] Auto screen dimming: disabled');
    } else {
      // Enable with specified delay
      this.autoTrackingModeEnabled = true;
      this.autoTrackingModeDelay = seconds;
      
      if (!this.isInTrackingMode && this.wasRunActivate && !this.isRunFinished) {
        this.startInactivityTimer();
      }
      console.log(`[ParticipantRun] Auto screen dimming: enabled with ${seconds}s delay`);
    }
  }

  /**
   * Register user interaction (to reset inactivity timer)
   */
  registerUserInteraction(): void {
    if (this.autoTrackingModeEnabled && !this.isInTrackingMode) {
      this.resetInactivityTimer();
    }
  }

  /**
   * Update tracking mode data
   * Note: Battery level is already updated by existing battery service subscription
   * This method is now minimal/empty as GPS data was removed per user request
   */
  updateTrackingModeData(): void {
    if (!this.isInTrackingMode) return;

    // Battery level is already updated by existing battery service subscription
    // No additional data needed in tracking mode (ultra-minimal approach)
  }

  /**
   * Confirm tracking mode info and activate
   */
  confirmTrackingModeInfo(): void {
    localStorage.setItem('trackingModeInfoSeen', 'true');

    // Transfer dialog settings to main settings
    this.autoTrackingModeEnabled = this.dialogAutoTrackingEnabled;
    this.autoTrackingModeDelay = this.dialogAutoTrackingDelay;

    // Start timer if auto-dimming is enabled
    if (this.autoTrackingModeEnabled && this.wasRunActivate && !this.isRunFinished) {
      this.startInactivityTimer();
    }

    this.showTrackingModeInfo = false;
    this.activateTrackingMode();
  }

  /**
   * Handle dialog auto-tracking toggle change
   */
  onDialogAutoTrackingChange(): void {
    console.log(`[ParticipantRun] Dialog auto-dimming: ${this.dialogAutoTrackingEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get tracking mode info message based on platform
   */
  getTrackingModeInfoMessage(): string {
    return this.trackingModeService.getWakeLockMessage();
  }

  /**
   * Handle visibility change to reacquire Wake Lock
   */
  private handleVisibilityChange(): void {
    if (this.isInTrackingMode) {
      this.trackingModeService.handleVisibilityChange();
    }
  }
}
