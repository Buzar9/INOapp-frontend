import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import {
  GpsTrackPoint,
  TrackingMode,
  TRACKING_CONFIGS,
  UserTrackingPreferences,
  TrackingConfig
} from '../models/gps-track.model';
import { TileDbService } from './tile-db.service';
import { BatteryService } from './battery.service';
import { ParticipantSendService } from './participant-send-service';

const PREFERENCES_KEY = 'gps-tracking-preferences';
const DEFAULT_PREFERENCES: UserTrackingPreferences = {
  mode: TrackingMode.HIGH,
  autoAdjustOnLowBattery: true,
  warnBeforeDisabling: true
};

@Injectable({
  providedIn: 'root'
})
export class GpsTrackingService {
  private watchId: number | null = null;
  private currentRunId: string | null = null;
  private currentMode: TrackingMode = TrackingMode.HIGH;
  private currentConfig: TrackingConfig = TRACKING_CONFIGS[TrackingMode.HIGH];

  private lastSavedPoint: GeolocationPosition | null = null;

  private isTracking$ = new BehaviorSubject<boolean>(false);
  private currentMode$ = new BehaviorSubject<TrackingMode>(TrackingMode.HIGH);
  private lastError$ = new BehaviorSubject<string | null>(null);

  private batterySubscription?: Subscription;
  private originalModeBeforeAutoAdjust?: TrackingMode;

  private pointsBuffer: GpsTrackPoint[] = [];
  private readonly BUFFER_SIZE = 50;
  private readonly UPLOAD_INTERVAL_MS = 60000; // 1 minuta
  private uploadIntervalId: any = null;

  constructor(
    private tileDbService: TileDbService,
    private batteryService: BatteryService,
    private participantSendService: ParticipantSendService
  ) {
    this.loadPreferences();
  }

  /**
   * Rozpoczyna tracking GPS dla danego biegu
   * UWAGA: GPS działa zawsze (dla checkpointów), OFF = nie zapisuje trasy
   */
  async startTracking(runId: string): Promise<void> {
    if (this.isTracking$.value) {
      console.warn('[GpsTrackingService] Tracking already active');
      return;
    }

    console.log('[GpsTrackingService] ===== STARTING GPS TRACKING =====');
    console.log('[GpsTrackingService] Run ID:', runId);
    this.currentRunId = runId;

    const preferences = this.getPreferences();
    this.currentMode = preferences.mode;
    this.currentConfig = TRACKING_CONFIGS[this.currentMode];
    this.currentMode$.next(this.currentMode);

    console.log('[GpsTrackingService] Mode:', this.currentMode);
    console.log('[GpsTrackingService] Config:', this.currentConfig);
    console.log('[GpsTrackingService] Preferences:', preferences);

    // GPS tracking ZAWSZE działa (potrzebne dla checkpointów)
    // Tryb OFF = nie zapisuje punktów trasy, ale GPS nadal działa
    console.log('[GpsTrackingService] Starting geolocation watch (mode:', this.currentMode, ')');
    this.startGeolocationWatch();
    this.startBatteryMonitoring();
    this.startUploadInterval();
    this.isTracking$.next(true);
    console.log('[GpsTrackingService] GPS tracking started successfully');
  }

  /**
   * Zatrzymuje tracking GPS
   */
  async stopTracking(): Promise<void> {
    console.log('[GpsTrackingService] Stopping GPS tracking');

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.stopBatteryMonitoring();
    this.stopUploadInterval();

    // Upload pozostałych punktów
    if (this.pointsBuffer.length > 0 && this.currentRunId) {
      await this.flushBuffer();
    }

    this.isTracking$.next(false);
    this.currentRunId = null;
    this.lastSavedPoint = null;
  }

  /**
   * Zmienia tryb trackingu (może być wywołane podczas biegu)
   */
  async changeTrackingMode(newMode: TrackingMode): Promise<void> {
    console.log('[GpsTrackingService] Changing tracking mode to:', newMode);

    const oldMode = this.currentMode;
    this.currentMode = newMode;
    this.currentConfig = TRACKING_CONFIGS[newMode];
    this.currentMode$.next(newMode);

    // Zapisz preferencje
    const preferences = this.getPreferences();
    preferences.mode = newMode;
    this.savePreferences(preferences);

    // Jeśli tracking aktywny, zrestartuj watch
    if (this.isTracking$.value && this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;

      if (this.currentConfig.enabled) {
        this.startGeolocationWatch();
      }
    }

    // Jeśli wyłączamy tracking, flush buffer
    if (oldMode !== TrackingMode.OFF && newMode === TrackingMode.OFF) {
      await this.flushBuffer();
    }
  }

  /**
   * Rozpoczyna nasłuchiwanie pozycji GPS
   */
  private startGeolocationWatch(): void {
    console.log('[GpsTrackingService] startGeolocationWatch() called');

    // Check if geolocation is available
    if (!('geolocation' in navigator)) {
      console.error('[GpsTrackingService] Geolocation API not available in this browser!');
      this.lastError$.next('Geolocation not supported');
      return;
    }

    const options = this.getGeolocationOptions();
    console.log('[GpsTrackingService] Geolocation options:', options);

    // First, request permission with getCurrentPosition to trigger browser permission prompt
    console.log('[GpsTrackingService] Requesting initial GPS permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[GpsTrackingService] Initial GPS permission granted, got position:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });

        // Now start continuous tracking with watchPosition
        try {
          this.watchId = navigator.geolocation.watchPosition(
            (position) => {
              console.log('[GpsTrackingService] Position received:', {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
              });
              this.handlePosition(position);
            },
            (error) => {
              console.error('[GpsTrackingService] Geolocation error callback triggered');
              this.handleError(error);
            },
            options
          );

          console.log('[GpsTrackingService] Geolocation watch started successfully. Watch ID:', this.watchId);
        } catch (error) {
          console.error('[GpsTrackingService] Exception while starting geolocation watch:', error);
          this.lastError$.next('Failed to start GPS watch');
        }
      },
      (error) => {
        console.error('[GpsTrackingService] Initial GPS permission denied or error:', error);
        this.handleError(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  /**
   * Zwraca opcje dla geolocation API na podstawie trybu
   */
  private getGeolocationOptions(): PositionOptions {
    const { accuracy, interval } = this.currentConfig;

    if (accuracy === 'high') {
      return {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      };
    } else if (accuracy === 'balanced') {
      return {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 10000
      };
    } else { // low
      return {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 30000
      };
    }
  }

  /**
   * Obsługuje nową pozycję z GPS
   */
  private async handlePosition(position: GeolocationPosition): Promise<void> {
    console.log('[GpsTrackingService] handlePosition() called. Mode:', this.currentMode, 'RunId:', this.currentRunId);

    if (!this.currentRunId) {
      console.warn('[GpsTrackingService] No currentRunId set, ignoring position');
      return;
    }

    // Jeśli tryb OFF - nie zapisuj punktów (ale GPS działa dla checkpointów)
    if (this.currentMode === TrackingMode.OFF) {
      console.log('[GpsTrackingService] Mode OFF - not saving route points');
      return;
    }

    const shouldSave = this.shouldSavePoint(position);
    console.log('[GpsTrackingService] shouldSavePoint:', shouldSave);

    if (shouldSave) {
      console.log('[GpsTrackingService] Creating and saving GPS point...');
      const point = this.createGpsPoint(position);
      console.log('[GpsTrackingService] GPS point created:', point);
      await this.savePoint(point);
      console.log('[GpsTrackingService] GPS point saved successfully');
      this.lastSavedPoint = position;
    }
  }

  /**
   * Sprawdza czy punkt powinien zostać zapisany
   */
  private shouldSavePoint(newPosition: GeolocationPosition): boolean {
    const lastPoint = this.lastSavedPoint;

    // Pierwszy punkt - zawsze zapisz
    if (!lastPoint) return true;

    // Sprawdź interwał czasowy
    const timeDelta = newPosition.timestamp - lastPoint.timestamp;
    if (timeDelta < this.currentConfig.interval!) {
      return false;
    }

    // Sprawdź dokładność
    if (newPosition.coords.accuracy > 100) {
      console.warn('[GpsTrackingService] Poor accuracy, skipping point:', newPosition.coords.accuracy);
      return false;
    }

    // Sprawdź dystans
    const distance = this.haversineDistance(
      lastPoint.coords.latitude,
      lastPoint.coords.longitude,
      newPosition.coords.latitude,
      newPosition.coords.longitude
    );

    if (distance < this.currentConfig.minDistance!) {
      return false; // Za blisko, user stoi
    }

    return true;
  }

  /**
   * Tworzy obiekt GPS point (minimalistyczny - backend doda metadane)
   */
  private createGpsPoint(position: GeolocationPosition): GpsTrackPoint {
    return {
      timestamp: position.timestamp,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      uploadedToBackend: false
    };
  }

  /**
   * Zapisuje punkt do bufora i IndexedDB
   */
  private async savePoint(point: GpsTrackPoint): Promise<void> {
    console.log('[GpsTrackingService] savePoint() called. Buffer size:', this.pointsBuffer.length);

    // Dodaj do bufora
    this.pointsBuffer.push(point);
    console.log('[GpsTrackingService] Point added to buffer. New buffer size:', this.pointsBuffer.length);

    // Zapisz do IndexedDB
    try {
      await this.tileDbService.saveGpsPoint(point);
      console.log('[GpsTrackingService] Point saved to IndexedDB successfully');
    } catch (error) {
      console.error('[GpsTrackingService] Error saving point to IndexedDB:', error);
    }

    // Jeśli buffer pełny, flush
    if (this.pointsBuffer.length >= this.BUFFER_SIZE) {
      console.log('[GpsTrackingService] Buffer full, flushing...');
      await this.flushBuffer();
    }
  }

  /**
   * Wysyła buffer do backendu
   */
  private async flushBuffer(): Promise<void> {
    if (this.pointsBuffer.length === 0 || !this.currentRunId) return;

    console.log('[GpsTrackingService] Flushing buffer:', this.pointsBuffer.length, 'points');
    console.log('[GpsTrackingService] Uploading to runId:', this.currentRunId);
    console.log('[GpsTrackingService] Points to upload:', this.pointsBuffer);

    const pointsToUpload = [...this.pointsBuffer];

    try {
      const response = await this.participantSendService.uploadGpsTrackBatch(this.currentRunId, pointsToUpload).toPromise();
      console.log('[GpsTrackingService] Upload response:', response);

      // Oznacz punkty jako wysłane
      const timestamps = pointsToUpload.map(p => p.timestamp);
      await this.tileDbService.markGpsPointsAsUploaded(timestamps);

      console.log('[GpsTrackingService] Successfully uploaded', pointsToUpload.length, 'points');
      this.pointsBuffer = [];
    } catch (error) {
      console.error('[GpsTrackingService] Failed to upload GPS points:', error);
      console.error('[GpsTrackingService] Error details:', error);
      // Punkty pozostają w buforze i będą ponownie wysłane
    }
  }

  /**
   * Obsługuje błędy geolocation
   */
  private handleError(error: GeolocationPositionError): void {
    let errorMessage = '';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Brak dostępu do GPS';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Pozycja GPS niedostępna';
        break;
      case error.TIMEOUT:
        errorMessage = 'Timeout GPS';
        break;
      default:
        errorMessage = 'Nieznany błąd GPS';
    }

    console.error('[GpsTrackingService] Geolocation error:', errorMessage, error);
    this.lastError$.next(errorMessage);
  }

  /**
   * Oblicza dystans haversine między dwoma punktami (w metrach)
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Promień Ziemi w metrach
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Monitoring baterii z auto-adjust
   */
  private startBatteryMonitoring(): void {
    const preferences = this.getPreferences();
    if (!preferences.autoAdjustOnLowBattery) return;

    this.batterySubscription = this.batteryService.getBatteryStatus().subscribe(status => {
      this.handleBatteryChange(status.level);
    });
  }

  private stopBatteryMonitoring(): void {
    if (this.batterySubscription) {
      this.batterySubscription.unsubscribe();
      this.batterySubscription = undefined;
    }
  }

  private handleBatteryChange(level: number): void {
    const preferences = this.getPreferences();
    if (!preferences.autoAdjustOnLowBattery) return;

    // Krytyczny poziom baterii (< 10%)
    if (level < 0.10 && this.currentMode !== TrackingMode.LOW && this.currentMode !== TrackingMode.OFF) {
      if (!this.originalModeBeforeAutoAdjust) {
        this.originalModeBeforeAutoAdjust = this.currentMode;
      }
      console.log('[GpsTrackingService] Critical battery, switching to LOW mode');
      this.changeTrackingMode(TrackingMode.LOW);
    }
    // Niski poziom baterii (< 20%)
    else if (level < 0.20 && this.currentMode === TrackingMode.MAX) {
      if (!this.originalModeBeforeAutoAdjust) {
        this.originalModeBeforeAutoAdjust = this.currentMode;
      }
      console.log('[GpsTrackingService] Low battery, switching from MAX to HIGH');
      this.changeTrackingMode(TrackingMode.HIGH);
    }
    // Powrót do normalnego poziomu (> 30%)
    else if (level > 0.30 && this.originalModeBeforeAutoAdjust) {
      console.log('[GpsTrackingService] Battery recovered, restoring mode:', this.originalModeBeforeAutoAdjust);
      this.changeTrackingMode(this.originalModeBeforeAutoAdjust);
      this.originalModeBeforeAutoAdjust = undefined;
    }
  }

  /**
   * Cykliczny upload do backendu
   */
  private startUploadInterval(): void {
    this.uploadIntervalId = setInterval(() => {
      this.flushBuffer();
    }, this.UPLOAD_INTERVAL_MS);
  }

  private stopUploadInterval(): void {
    if (this.uploadIntervalId) {
      clearInterval(this.uploadIntervalId);
      this.uploadIntervalId = null;
    }
  }

  /**
   * Zarządzanie preferencjami
   */
  private loadPreferences(): void {
    const preferences = this.getPreferences();
    this.currentMode = preferences.mode;
    this.currentMode$.next(this.currentMode);
  }

  getPreferences(): UserTrackingPreferences {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      } catch (e) {
        console.error('[GpsTrackingService] Failed to parse preferences:', e);
      }
    }
    return { ...DEFAULT_PREFERENCES };
  }

  savePreferences(preferences: UserTrackingPreferences): void {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }

  /**
   * Observables
   */
  isTracking(): Observable<boolean> {
    return this.isTracking$.asObservable();
  }

  getCurrentMode(): Observable<TrackingMode> {
    return this.currentMode$.asObservable();
  }

  getLastError(): Observable<string | null> {
    return this.lastError$.asObservable();
  }

  getCurrentModeValue(): TrackingMode {
    return this.currentMode;
  }

  /**
   * Pobierz wszystkie punkty GPS
   */
  async getAllTrackPoints(): Promise<GpsTrackPoint[]> {
    return this.tileDbService.getAllGpsPoints();
  }

  /**
   * Pobierz punkty oczekujące na upload
   */
  async getPendingPoints(): Promise<GpsTrackPoint[]> {
    return this.tileDbService.getPendingGpsPoints();
  }

  /**
   * Wyczyść wszystkie punkty GPS z IndexedDB (lokalnie).
   * Punkty pozostają na backendzie.
   */
  async clearAllTrackPoints(): Promise<void> {
    await this.tileDbService.clearAllGpsPoints();
  }

  /**
   * Pobierz ostatnią zapisaną pozycję GPS.
   * Używane jako fallback gdy getCurrentPosition nie działa.
   */
  getLastPosition(): GeolocationPosition | null {
    return this.lastSavedPoint;
  }
}
