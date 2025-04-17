import { NgModule } from '@angular/core';
import { NgxScannerQrcodeComponent } from 'ngx-scanner-qrcode';
import { FormsModule } from '@angular/forms';
import { DexieService } from './services/dexie.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
// dodo
@NgModule({
  declarations: [],
  imports: [NgxScannerQrcodeComponent, FormsModule],
  providers: [],
  bootstrap: []
})
export class AppModule { }