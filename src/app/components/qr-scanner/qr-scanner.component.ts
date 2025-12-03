import { AfterViewInit, Component, ViewChild, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScannerQRCodeConfig,
  ScannerQRCodeResult,
  NgxScannerQrcodeService,
  NgxScannerQrcodeComponent,
  ScannerQRCodeSelectedFiles,
} from 'ngx-scanner-qrcode';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'qr-scanner',
  standalone: true,
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.css',
  imports: [NgxScannerQrcodeComponent, CommonModule, ButtonModule, RippleModule, ProgressSpinnerModule, TooltipModule],
})
export class QrScannerComponent implements AfterViewInit {
  @Input() downloadImage: boolean = true;
  @Output() qrCodeScanned = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>()
  public config: ScannerQRCodeConfig = {
    constraints: {
      video: {
        width: window.innerWidth,
      },
    }
  };

  private lastScanTime = 0;
  private scanCooldown = 500;

  // Torch (flashlight) state
  public isTorchOn = false;
  public isTorchAvailable = false;

  public qrCodeResult: ScannerQRCodeSelectedFiles[] = [];

  @ViewChild('action') action!: NgxScannerQrcodeComponent;

  public percentage = 80;
  public quality = 100;

  constructor(private qrcode: NgxScannerQrcodeService) {}

  ngAfterViewInit(): void {
    this.action.isReady.subscribe((res: any) => {
      if (res) {
        this.handle(this.action, 'start');
        // Check torch availability after camera starts
        setTimeout(() => this.checkTorchAvailability(), 500);
      }
    });
  }

  private async checkTorchAvailability(): Promise<void> {
    try {
      const video = this.action.video?.nativeElement;
      if (!video || !video.srcObject) {
        this.isTorchAvailable = false;
        return;
      }

      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];

      if (track) {
        const capabilities = track.getCapabilities?.() as any;
        this.isTorchAvailable = capabilities?.torch === true;
        console.log('Torch available:', this.isTorchAvailable);
      }
    } catch (error) {
      console.warn('Could not check torch availability:', error);
      this.isTorchAvailable = false;
    }
  }

  public async toggleTorch(): Promise<void> {
    try {
      const video = this.action.video?.nativeElement;
      if (!video || !video.srcObject) {
        console.warn('Video element not available');
        return;
      }

      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];

      if (!track) {
        console.warn('No video track found');
        return;
      }

      const newTorchState = !this.isTorchOn;

      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });

      this.isTorchOn = newTorchState;
      console.log('Torch toggled:', this.isTorchOn);
    } catch (error) {
      console.error('Error toggling torch:', error);
      this.toggleTorchWithImageCapture();
    }
  }

  private async toggleTorchWithImageCapture(): Promise<void> {
    try {
      const video = this.action.video?.nativeElement;
      if (!video || !video.srcObject) return;

      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];

      if (!track || !(window as any).ImageCapture) {
        console.warn('ImageCapture API not supported');
        return;
      }

      const imageCapture = new (window as any).ImageCapture(track);
      const capabilities = await imageCapture.getPhotoCapabilities();

      if (capabilities.fillLightMode?.includes('flash')) {
        const newTorchState = !this.isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: newTorchState } as any]
        });
        this.isTorchOn = newTorchState;
      }
    } catch (error) {
      console.error('ImageCapture fallback failed:', error);
    }
  }

  public onEvent(scanResult: ScannerQRCodeResult[], action?: any): void {
    if (!scanResult || scanResult.length === 0 || !scanResult[0]?.value) {
      return;
    }

    // Debouncing - zapobiegaj zbyt częstemu skanowaniu
    const now = Date.now();
    if (now - this.lastScanTime < this.scanCooldown) {
      return;
    }
    this.lastScanTime = now;

    if (this.downloadImage) {
      this.downloadQrCodeImage();
    }

    if (this.action && this.action.isStart) {
      this.action.stop();
    }

    const qrValue = scanResult[0].value;

    this.qrCodeScanned.emit(qrValue)
  }

  private downloadQrCodeImage(): void {
    try {
      const video = this.action.video?.nativeElement;

      if (!video) {
        console.error('Nie znaleziono video elementu');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          return;
        }

        const filename = new Date().toLocaleString('sv-SE', { hour12: false }) + '.png';

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        requestAnimationFrame(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        });

      }, 'image/png');

    } catch (error) {
      console.error('Błąd podczas pobierania obrazu:', error);
    }
  }

  public handle(action: any, fn: string): void {
    const playDeviceFacingBack = (devices: any[]) => {
      const device = devices.find((f) =>
        /back|rear|environment/gi.test(f.label)
      );
      action.playDevice(device ? device.deviceId : devices[0].deviceId);
    };

      action[fn](playDeviceFacingBack);
  }

  public onSelects(files: any) {
    this.qrcode
      .loadFiles(files, this.percentage, this.quality)
      .subscribe((res: ScannerQRCodeSelectedFiles[]) => {
        this.qrCodeResult = res;
      });
  }

  closeScanner() {
    if (this.isTorchOn) {
      this.toggleTorch();
    }
    if (this.action && this.action.isStart) {
      this.action.stop();
    }
    this.close.emit();
  }
}
