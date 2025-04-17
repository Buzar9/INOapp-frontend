import { Injectable } from '@angular/core';
// import { IndexedDBService } from './indexed-db.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { importProvidersFrom } from '@angular/core';
import { DexieService } from './dexie.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  constructor(
    // private idbService: IndexedDBService, 
    private dexieService: DexieService,
    private http: HttpClient
  ) {
    window.addEventListener('online', () => {
      this.syncData();
    });
  }

  async syncData(): Promise<void> {
    const unsynced = await this.dexieService.getUnsyncedData();
    for (const data of unsynced) {
      this.http.post('/api/submitQR', data)
        .pipe(
          catchError(error => {
            console.error('Sync error:', error);
            throw error;
          })
        )
        .subscribe(async () => {
          await this.dexieService.markAsSynced(data.id!);
        });
    }
  }
}
