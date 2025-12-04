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

  // Wake Lock reacquisition interval
  private wakeLockCheckInterval: any = null;

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

      // Start periodic Wake Lock check
      this.startPeriodicWakeLockCheck();

      // Update state
      this.isTrackingMode.set(true);

      console.log('[Tracking Mode] Enabled successfully');
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

      // Stop periodic Wake Lock check
      this.stopPeriodicWakeLockCheck();

      // Update state
      this.isTrackingMode.set(false);

      console.log('[Tracking Mode] Disabled successfully');
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

        // Handle wake lock release (e.g., when tab becomes hidden or system releases it)
        this.wakeLock.addEventListener('release', () => {
          const timestamp = new Date().toISOString();
          console.log(`[Wake Lock] Released at ${timestamp}`);

          // Automatically reacquire if still in tracking mode
          if (this.isTrackingMode()) {
            console.log('[Wake Lock] Attempting to reacquire after release...');
            setTimeout(() => {
              this.reacquireWakeLock();
            }, 100); // Small delay to avoid immediate reacquisition issues
          }
        });

        const timestamp = new Date().toISOString();
        console.log(`[Wake Lock] Acquired successfully at ${timestamp}`);
      }
    } catch (error: any) {
      console.error('[Wake Lock] Request failed:', error);

      // Common errors:
      // - NotAllowedError: User didn't interact with page
      // - NotSupportedError: Wake Lock not supported
      if (error.name === 'NotAllowedError') {
        console.warn('[Wake Lock] Requires user interaction');
      } else if (error.name === 'NotSupportedError') {
        console.warn('[Wake Lock] Not supported on this device');
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
   * Start periodic Wake Lock check and reacquisition
   * Checks every 10 seconds if Wake Lock is still active
   */
  private startPeriodicWakeLockCheck(): void {
    // Clear existing interval if any
    this.stopPeriodicWakeLockCheck();

    // Check every 10 seconds
    this.wakeLockCheckInterval = setInterval(async () => {
      if (!this.isTrackingMode()) {
        return; // Exit if no longer in tracking mode
      }

      // Check if Wake Lock is null or released
      if (this.wakeLock === null || this.wakeLock.released) {
        const timestamp = new Date().toISOString();
        console.log(`[Wake Lock] Detected released/null Wake Lock at ${timestamp}, reacquiring...`);
        await this.reacquireWakeLock();
      } else {
        console.log('[Wake Lock] Still active ✓');
      }
    }, 10000); // 10 seconds

    console.log('[Wake Lock] Periodic check started (every 10s)');
  }

  /**
   * Stop periodic Wake Lock check
   */
  private stopPeriodicWakeLockCheck(): void {
    if (this.wakeLockCheckInterval) {
      clearInterval(this.wakeLockCheckInterval);
      this.wakeLockCheckInterval = null;
      console.log('[Wake Lock] Periodic check stopped');
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
