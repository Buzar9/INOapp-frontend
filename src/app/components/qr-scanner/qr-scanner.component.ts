import { AfterViewInit, Component, ViewChild, Output, EventEmitter } from '@angular/core';
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

  public qrCodeResult: ScannerQRCodeSelectedFiles[] = [];

  @ViewChild('action') action!: NgxScannerQrcodeComponent;

  public percentage = 80;
  public quality = 100;

  constructor(private qrcode: NgxScannerQrcodeService) {}

  ngAfterViewInit(): void {
    this.action.isReady.subscribe((res: any) => {
      if (res) {
        this.handle(this.action, 'start');
      }
    });
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
    
    this.downloadQrCodeImage();
    
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
    if (this.action && this.action.isStart) {
      this.action.stop();
    }
    this.close.emit();
  }
}
