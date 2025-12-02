import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BatteryStatus {
  level: number; // 0-1
  charging: boolean;
  levelPercentage: number; // 0-100
}

@Injectable({
  providedIn: 'root'
})
export class BatteryService {
  private batteryStatus$ = new BehaviorSubject<BatteryStatus>({
    level: 1,
    charging: false,
    levelPercentage: 100
  });

  private battery: any = null;

  constructor() {
    this.initBatteryMonitoring();
  }

  private async initBatteryMonitoring(): Promise<void> {
    if ('getBattery' in navigator) {
      try {
        this.battery = await (navigator as any).getBattery();
        this.updateBatteryStatus();

        // Nasłuchuj zmian poziomu baterii
        this.battery.addEventListener('levelchange', () => {
          this.updateBatteryStatus();
        });

        // Nasłuchuj zmian statusu ładowania
        this.battery.addEventListener('chargingchange', () => {
          this.updateBatteryStatus();
        });
      } catch (error) {
        console.warn('[BatteryService] Battery API not available:', error);
      }
    } else {
      console.warn('[BatteryService] Battery API not supported in this browser');
    }
  }

  private updateBatteryStatus(): void {
    if (this.battery) {
      const status: BatteryStatus = {
        level: this.battery.level,
        charging: this.battery.charging,
        levelPercentage: Math.round(this.battery.level * 100)
      };
      this.batteryStatus$.next(status);
      console.log('[BatteryService] Battery status updated:', status);
    }
  }

  getBatteryStatus(): Observable<BatteryStatus> {
    return this.batteryStatus$.asObservable();
  }

  getCurrentBatteryLevel(): number {
    return this.batteryStatus$.value.level;
  }

  getCurrentBatteryPercentage(): number {
    return this.batteryStatus$.value.levelPercentage;
  }

  isCharging(): boolean {
    return this.batteryStatus$.value.charging;
  }

  isBatteryLow(): boolean {
    return this.batteryStatus$.value.level < 0.20 && !this.batteryStatus$.value.charging;
  }

  isBatteryCritical(): boolean {
    return this.batteryStatus$.value.level < 0.10 && !this.batteryStatus$.value.charging;
  }
}
