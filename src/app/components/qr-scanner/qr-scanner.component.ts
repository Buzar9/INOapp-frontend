import { AfterViewInit, Component, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  ScannerQRCodeConfig,
  ScannerQRCodeResult,
  NgxScannerQrcodeService,
  NgxScannerQrcodeComponent,
  ScannerQRCodeSelectedFiles,
  ScannerQRCodeSymbolType,
  // NgxScannerQrcodeModule,
  LOAD_WASM,
} from 'ngx-scanner-qrcode';
import { SafePipe } from './safe.pipe';
import { QrData } from '../../utils/QrData';
import { DodoTest } from '../../utils/DodoTest';
import { scan } from 'rxjs';
import { STATION_TYPES, ROUTE_NAMES } from '../../services/scan-mapper.service';

// Necessary to solve the problem of losing internet connection
// LOAD_WASM().subscribe((res) => {
//   console.log('LOAD_WASM', res);
// });

@Component({
  selector: 'qr-scanner',
  templateUrl: './qr-scanner.component.html',
  imports: [NgxScannerQrcodeComponent, SafePipe, CommonModule, NgFor],
})
export class QrScannerComponent implements AfterViewInit {
  @Output() qrCodeScanned = new EventEmitter<QrData>();
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

  constructor(private qrcode: NgxScannerQrcodeService,
    // private scanMapper: ScanMapper
  ) {}

  ngAfterViewInit(): void {
    this.action.isReady.subscribe((res: any) => {
      // this.handle(this.action, 'start');
    });
  }

  public onEvent(scanResult: ScannerQRCodeResult[], action?: any): void {
    if (action != undefined) {
      action['stop']();
    }
    
    // dodoEncode moduł dla organizatorów
    // console.log('kodowanie\n',this.encode('i=4&t=c&rn=ex'))

    let dodo = this.decode(scanResult[0].value)
    let dodoTest = Object.fromEntries(new URLSearchParams(dodo)) as DodoTest;
    
    let qrData = this.mapToQrData(dodoTest)
    this.qrCodeScanned.emit(qrData)
  }

  public handle(action: any, fn: string): void {
    const playDeviceFacingBack = (devices: any[]) => {
      // front camera or back camera check here!
      const device = devices.find((f) =>
        /back|rear|environment/gi.test(f.label)
      ); // Default Back Facing Camera
      action.playDevice(device ? device.deviceId : devices[0].deviceId);
    };

    // if (fn === 'start') {
      action[fn](playDeviceFacingBack);
    // } else {
    //   action[fn]().subscribe((r: any) => console.log(fn, r), alert);
    // }
  }

  // dodo kasowanie pobranego pliku
  public onDowload(action: NgxScannerQrcodeComponent) {
    action.download();
  }

  public onSelects(files: any) {
    this.qrcode
      .loadFiles(files, this.percentage, this.quality)
      .subscribe((res: ScannerQRCodeSelectedFiles[]) => {
        this.qrCodeResult = res;
      });
  }

  encode(data: string): string {
    const buf = new TextEncoder().encode(data);
    const bin = String. fromCharCode(...buf);
    return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g,'_')
    .replace(/=+$/, '');
  }

  decode(token:string) : string {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(token.length + (4 - (token.length % 4)) % 4, '=');
    const binary = atob(base64);
    return new TextDecoder().decode(
      new Uint8Array([...binary].map((ch) => ch.charCodeAt(0))));
    }

    mapToQrData(dodoTest: DodoTest): QrData {
            return {
                type: STATION_TYPES.getOrNull(dodoTest.t),
                routeName: ROUTE_NAMES.getOrNull(dodoTest.rn),
                id: dodoTest.i
            }
        }
}
// bootstrapApplication(DentureQrScannerComponent);
