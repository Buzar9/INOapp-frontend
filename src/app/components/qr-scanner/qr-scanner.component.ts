import { AfterViewInit, Component, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import {
  ScannerQRCodeConfig,
  ScannerQRCodeResult,
  NgxScannerQrcodeService,
  NgxScannerQrcodeComponent,
  ScannerQRCodeSelectedFiles,
} from 'ngx-scanner-qrcode';
import { SafePipe } from './safe.pipe';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'qr-scanner',
  templateUrl: './qr-scanner.component.html',
  imports: [NgxScannerQrcodeComponent, SafePipe, CommonModule, ButtonModule, RippleModule],
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
    if (action != undefined) {
      action['stop']();
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
    this.close.emit();
  }
}
