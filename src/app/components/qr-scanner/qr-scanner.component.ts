import { AfterViewInit, Component, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
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

  public qrCodeResult: ScannerQRCodeSelectedFiles[] = [];

  @ViewChild('action') action!: NgxScannerQrcodeComponent;

  public percentage = 80;
  public quality = 100;

  constructor(private qrcode: NgxScannerQrcodeService) {}

  ngAfterViewInit(): void {
    this.action.isReady.subscribe((res: any) => {
    });
  }

  public onEvent(scanResult: ScannerQRCodeResult[], action?: any): void {
    // Zatrzymaj kamerę przed wysłaniem wyniku
    if (this.action && this.action.isStart) {
      this.action.stop();
    }

    this.qrCodeScanned.emit(scanResult[0].value)
  }

  public handle(action: any, fn: string): void {
    const playDeviceFacingBack = (devices: any[]) => {
      // front camera or back camera check here!
      const device = devices.find((f) =>
        /back|rear|environment/gi.test(f.label)
      ); // Default Back Facing Camera
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
    // Zatrzymaj kamerę przed zamknięciem skanera
    if (this.action && this.action.isStart) {
      this.action.stop();
    }
    this.close.emit();
  }
}
