import { Component, OnInit, OnDestroy, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';

/**
 * Minimal UI component for power-saving tracking mode
 * Displays black screen with minimal HUD showing essential info
 */
@Component({
  selector: 'app-tracking-mode',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-mode.component.html',
  styleUrl: './tracking-mode.component.css'
})
export class TrackingModeComponent implements OnInit, OnDestroy {
  // Input signals
  batteryLevel = input<number>(100); // 0-100%
  gpsTrackingEnabled = input<boolean>(false);
  gpsStatus = input<'active' | 'error' | 'off'>('off'); // GPS status indicator

  // Output event
  exitTrackingMode = output<void>();

  // Local state
  currentTime = new Date();

  private timeUpdateSubscription?: Subscription;

  ngOnInit(): void {
    // Update current time every second
    this.timeUpdateSubscription = interval(1000).subscribe(() => {
      this.currentTime = new Date();
    });
  }

  ngOnDestroy(): void {
    this.timeUpdateSubscription?.unsubscribe();
  }

  /**
   * Get battery level class for styling
   */
  getBatteryClass(): string {
    const level = this.batteryLevel();

    if (level < 10) {
      return 'battery-critical';
    } else if (level < 20) {
      return 'battery-low';
    } else if (level < 50) {
      return 'battery-medium';
    } else {
      return 'battery-good';
    }
  }

  /**
   * Handle exit button click
   */
  onExitClick(): void {
    this.exitTrackingMode.emit();
  }
}
