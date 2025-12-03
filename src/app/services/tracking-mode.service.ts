import { Injectable, signal } from '@angular/core';

/**
 * Service for managing power-saving tracking mode with Wake Lock API
 * Keeps the screen on but with minimal display to save battery
 */
@Injectable({
  providedIn: 'root'
})
export class TrackingModeService {
  // Wake Lock API reference
  private wakeLock: WakeLockSentinel | null = null;

  // Keep-alive interval to prevent JavaScript throttling
  private keepAliveInterval: any = null;

  // Tracking mode state (reactive signal)
  public isTrackingMode = signal<boolean>(false);

  // Wake Lock support detection
  public isWakeLockSupported = signal<boolean>(false);

  // Platform detection
  public platform = signal<'ios' | 'android' | 'unknown'>('unknown');

  constructor() {
    this.detectPlatform();
    this.checkWakeLockSupport();
  }

  /**
   * Detect platform (iOS/Android/Unknown)
   */
  private detectPlatform(): void {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      this.platform.set('ios');
    } else if (/android/i.test(userAgent)) {
      this.platform.set('android');
    } else {
      this.platform.set('unknown');
    }
  }

  /**
   * Check if Wake Lock API is supported
   */
  private checkWakeLockSupport(): void {
    if ('wakeLock' in navigator) {
      this.isWakeLockSupported.set(true);
    } else {
      this.isWakeLockSupported.set(false);
      console.warn('Wake Lock API not supported on this device/browser');
    }
  }

  /**
   * Enable tracking mode with Wake Lock
   */
  async enableTrackingMode(): Promise<boolean> {
    try {
      // Request Wake Lock if supported
      if (this.isWakeLockSupported()) {
        await this.requestWakeLock();
      } else {
        console.warn('Wake Lock not supported - screen may turn off automatically');
      }

      // Start keep-alive mechanism
      this.startKeepAlive();

      // Update state
      this.isTrackingMode.set(true);

      console.log('Tracking mode enabled');
      return true;
    } catch (error) {
      console.error('Failed to enable tracking mode:', error);
      return false;
    }
  }

  /**
   * Disable tracking mode and release Wake Lock
   */
  async disableTrackingMode(): Promise<void> {
    try {
      // Release Wake Lock
      await this.releaseWakeLock();

      // Stop keep-alive
      this.stopKeepAlive();

      // Update state
      this.isTrackingMode.set(false);

      console.log('Tracking mode disabled');
    } catch (error) {
      console.error('Failed to disable tracking mode:', error);
    }
  }

  /**
   * Request Wake Lock to prevent screen sleep
   */
  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');

        // Handle wake lock release (e.g., when tab becomes hidden)
        this.wakeLock.addEventListener('release', () => {
          console.log('Wake Lock was released');
        });

        console.log('Wake Lock acquired');
      }
    } catch (error: any) {
      console.error('Wake Lock request failed:', error);

      // Common errors:
      // - NotAllowedError: User didn't interact with page
      // - NotSupportedError: Wake Lock not supported
      if (error.name === 'NotAllowedError') {
        console.warn('Wake Lock requires user interaction');
      }
    }
  }

  /**
   * Release Wake Lock
   */
  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLock !== null) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('Wake Lock released');
      } catch (error) {
        console.error('Failed to release Wake Lock:', error);
      }
    }
  }

  /**
   * Re-acquire Wake Lock (e.g., after page visibility change)
   */
  async reacquireWakeLock(): Promise<void> {
    if (this.isTrackingMode() && this.isWakeLockSupported()) {
      await this.requestWakeLock();
    }
  }

  /**
   * Start keep-alive ping to prevent JavaScript throttling
   * Sends a console log every 30 seconds to keep the JS context active
   */
  private startKeepAlive(): void {
    // Clear existing interval if any
    this.stopKeepAlive();

    // Ping every 30 seconds
    this.keepAliveInterval = setInterval(() => {
      const now = new Date().toISOString();
      console.log(`[Keep-Alive] App active at ${now}`);

      // Optional: Send a small request to server to maintain connection
      // This can help prevent server-side timeouts
      // this.http.get('/api/ping').subscribe();
    }, 30000); // 30 seconds

    console.log('Keep-alive mechanism started');
  }

  /**
   * Stop keep-alive ping
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('Keep-alive mechanism stopped');
    }
  }

  /**
   * Handle visibility change (when user switches tabs/apps)
   */
  handleVisibilityChange(): void {
    if (document.hidden) {
      console.log('App became hidden - Wake Lock may be released');
    } else {
      console.log('App became visible');

      // Try to reacquire Wake Lock if in tracking mode
      if (this.isTrackingMode()) {
        this.reacquireWakeLock();
      }
    }
  }

  /**
   * Get user-friendly message about Wake Lock support
   */
  getWakeLockMessage(): string {
    const platform = this.platform();
    const supported = this.isWakeLockSupported();

    if (platform === 'ios') {
      return 'iOS: Zostaw aplikację otwartą. Wake Lock nie jest wspierany.';
    } else if (platform === 'android' && supported) {
      return 'Ekran nie wyłączy się automatycznie podczas trackingu.';
    } else {
      return 'Upewnij się, że aplikacja pozostaje otwarta podczas biegu.';
    }
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.disableTrackingMode();
  }
}
