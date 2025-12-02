import { Injectable } from '@angular/core';
import { GpsTrackPoint } from '../models/gps-track.model';

export interface MapMetadata {
  id: string;
  name?: string;
  minZoom: number;
  maxZoom: number;
  bounds?: {
    south: number; west: number; north: number; east: number;
  };
  tms?: boolean;
  tileSize?: number;
  // Storage management fields
  sizeBytes?: number;          // rozmiar mapy w bajtach
  downloadedAt?: number;       // timestamp pobrania (Date.now())
  lastAccessedAt?: number;     // ostatni dostęp do mapy
  isPinned?: boolean;          // chroniona przed auto-cleanup
  usedInRoutes?: string[];     // ID tras używających tej mapy
}

export interface ParticipantSessionState {
  id: string;                  // Stała wartość 'current-session' dla łatwego dostępu
  runId: string;
  categoryId: string;
  competitionId: string;
  participantUnit: string;
  participantName: string;
  wasRunActivate: boolean;
  isRunFinished: boolean;
  runStartTime: number;
  raceTimeDisplay: string;
  checkpointsNumber: number;
  pendingRequests: any[];      // Kolejka zaległych requestów do wysłania
  savedAt: number;             // Timestamp zapisania stanu
  gpsTrackingEnabled?: boolean; // Czy tracking GPS był włączony
  gpsTrackingMode?: string;     // Tryb trackingu
}

interface TileRecord {
  key: string;          // `${mapId}/${z}/${x}/${y}`
  mapId: string;
  z: number;
  x: number;
  y: number;
  blob: Blob;
  contentType: string;
}

@Injectable({ providedIn: 'root' })
export class TileDbService {
  private dbPromise?: Promise<IDBDatabase>;
  private dbName = 'offline-maps';
  private dbVersion = 5;  // Zwiększona wersja aby wymusić upgrade
  private tilesStore = 'tiles';
  private mapsStore = 'maps';
  private sessionStore = 'session';  // Nowy store dla stanu sesji uczestnika
  private gpsTracksStore = 'gps-tracks';  // Store dla punktów GPS trackingu

  constructor() {
    // Przydatne do szybkiego debugowania z konsoli: window.tileDbDebug.countTilesForMap('mapId')
    try {
      // @ts-ignore - celowo dodajemy debug helper w przeglądarce
      if (typeof window !== 'undefined') {
        // attach lazily bound helper
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).tileDbDebug = {
          countTilesForMap: async (mapId: string) => this.countTilesForMap(mapId)
        };
      }
    } catch (e) {
      // ignore in non-browser environments
    }
  }

  private ensureDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const openInitial = () => {
          const req = indexedDB.open(this.dbName, this.dbVersion);

          req.onupgradeneeded = (event) => {
            const db = req.result;
            const oldVersion = event.oldVersion;
            console.log(`TileDbService: onupgradeneeded - upgrading from v${oldVersion} to v${this.dbVersion}`);

            if (!db.objectStoreNames.contains(this.tilesStore)) {
              const tiles = db.createObjectStore(this.tilesStore, { keyPath: 'key' });
              tiles.createIndex('byMap', 'mapId', { unique: false });
              tiles.createIndex('byMapZ', ['mapId', 'z'], { unique: false });
            }
            if (!db.objectStoreNames.contains(this.mapsStore)) {
              db.createObjectStore(this.mapsStore, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(this.sessionStore)) {
              db.createObjectStore(this.sessionStore, { keyPath: 'id' });
            }

            // GPS tracks store - usuń stary i utwórz nowy jeśli upgrade z wersji < 5
            if (oldVersion < 5 && db.objectStoreNames.contains(this.gpsTracksStore)) {
              console.log('TileDbService: Dropping old gps-tracks store for schema update');
              db.deleteObjectStore(this.gpsTracksStore);
            }

            if (!db.objectStoreNames.contains(this.gpsTracksStore)) {
              console.log('TileDbService: Creating gps-tracks store with proper schema');
              const gpsStore = db.createObjectStore(this.gpsTracksStore, { keyPath: 'timestamp' });
              gpsStore.createIndex('byTimestamp', 'timestamp', { unique: false });
              gpsStore.createIndex('byUploadStatus', 'uploadedToBackend', { unique: false });
            }
          };

          req.onsuccess = () => {
            const db = req.result;
            // If stores are missing for some reason (old DB), perform an upgrade by reopening with higher version
            const hasTiles = db.objectStoreNames.contains(this.tilesStore);
            const hasMaps = db.objectStoreNames.contains(this.mapsStore);
            const hasSession = db.objectStoreNames.contains(this.sessionStore);
            const hasGpsTracks = db.objectStoreNames.contains(this.gpsTracksStore);
            if (hasTiles && hasMaps && hasSession && hasGpsTracks) {
              resolve(db);
              return;
            }

            const newVersion = (db.version || 0) + 1;
            console.warn(`TileDbService: object stores missing (tiles:${hasTiles} maps:${hasMaps} session:${hasSession} gpsTracks:${hasGpsTracks}), upgrading DB to v${newVersion}`);
            db.close();

            const req2 = indexedDB.open(this.dbName, newVersion);
            req2.onupgradeneeded = (event2) => {
              const db2 = req2.result;
              const oldVersion2 = event2.oldVersion;
              console.log(`TileDbService: onupgradeneeded (forced) - upgrading from v${oldVersion2} to v${newVersion}`);

              if (!db2.objectStoreNames.contains(this.tilesStore)) {
                const tiles = db2.createObjectStore(this.tilesStore, { keyPath: 'key' });
                tiles.createIndex('byMap', 'mapId', { unique: false });
                tiles.createIndex('byMapZ', ['mapId', 'z'], { unique: false });
              }
              if (!db2.objectStoreNames.contains(this.mapsStore)) {
                db2.createObjectStore(this.mapsStore, { keyPath: 'id' });
              }
              if (!db2.objectStoreNames.contains(this.sessionStore)) {
                db2.createObjectStore(this.sessionStore, { keyPath: 'id' });
              }

              // GPS tracks store - usuń stary i utwórz nowy jeśli upgrade z wersji < 5
              if (oldVersion2 < 5 && db2.objectStoreNames.contains(this.gpsTracksStore)) {
                console.log('TileDbService: Dropping old gps-tracks store for schema update (forced)');
                db2.deleteObjectStore(this.gpsTracksStore);
              }

              if (!db2.objectStoreNames.contains(this.gpsTracksStore)) {
                console.log('TileDbService: Creating gps-tracks store with proper schema (forced)');
                const gpsStore = db2.createObjectStore(this.gpsTracksStore, { keyPath: 'timestamp' });
                gpsStore.createIndex('byTimestamp', 'timestamp', { unique: false });
                gpsStore.createIndex('byUploadStatus', 'uploadedToBackend', { unique: false });
              }
            };
            req2.onsuccess = () => resolve(req2.result);
            req2.onerror = () => reject(req2.error);
          };

          req.onerror = () => reject(req.error);
        };

        openInitial();
      });
    }
    return this.dbPromise;
  }

  async hasTilesForMap(mapId: string): Promise<boolean> {
    const db = await this.ensureDb();
    return new Promise((resolve) => {
      const transaction = db.transaction(this.tilesStore, 'readonly');
      const store = transaction.objectStore(this.tilesStore);
      const index = store.index('byMap');
      
      // Używamy count() zamiast get(), bo wystarczy nam informacja czy istnieją jakiekolwiek kafelki
      const countRequest = index.count(IDBKeyRange.only(mapId));
      
      countRequest.onsuccess = () => {
        // Jeśli znaleziono jakiekolwiek kafelki dla tej mapy, zwracamy true
        resolve(countRequest.result > 0);
      };
      
      countRequest.onerror = () => {
        console.error('Błąd podczas sprawdzania kafelków mapy:', countRequest.error);
        resolve(false);
      };
    });
  }

  private txDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private promisify<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private tileKey(mapId: string, z: number, x: number, y: number) {
    return `${mapId}/${z}/${x}/${y}`;
  }

  async putTiles(
    mapId: string,
    tiles: Array<{ z: number; x: number; y: number; blob: Blob; contentType?: string }>
  ): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.tilesStore], 'readwrite');
    const store = tx.objectStore(this.tilesStore);
    try {
      let sampleKey: string | null = null;
      for (const t of tiles) {
        const rec: TileRecord = {
          key: this.tileKey(mapId, t.z, t.x, t.y),
          mapId,
          z: t.z, x: t.x, y: t.y,
          blob: t.blob,
          contentType: t.contentType || 'image/png'
        };
        store.put(rec);
        if (!sampleKey) sampleKey = rec.key;
      }

      console.log(`TileDbService.putTiles: queued ${tiles.length} tiles for mapId=${mapId}`, sampleKey ? `sampleKey=${sampleKey}` : 'no-sample');

      await this.txDone(tx);
      console.log(`TileDbService.putTiles: transaction complete for mapId=${mapId}, wrote ${tiles.length} tiles`);
    } catch (err) {
      console.error('TileDbService.putTiles: transaction error', err);
      throw err;
    }
  }

  async getTile(mapId: string, z: number, x: number, y: number): Promise<Blob | null> {
    const db = await this.ensureDb();
    const store = db.transaction([this.tilesStore], 'readonly').objectStore(this.tilesStore);
    const rec = await this.promisify<TileRecord | undefined>(store.get(this.tileKey(mapId, z, x, y)));
    return rec?.blob || null;
  }

  async clearMap(mapId: string): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.tilesStore], 'readwrite');
    const store = tx.objectStore(this.tilesStore);
    const idx = store.index('byMap');
    const range = IDBKeyRange.only(mapId);

    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    await this.txDone(tx);
  }

  /**
   * Usuń wszystkie kafelki oraz metadane map z IndexedDB.
   * Użyteczne przy wylogowaniu — czyści cache map.
   */
  async clearAllMaps(): Promise<void> {
    const db = await this.ensureDb();
    // clear both stores in a single transaction if possible
    const tx = db.transaction([this.tilesStore, this.mapsStore], 'readwrite');
    const tilesStore = tx.objectStore(this.tilesStore);
    const mapsStore = tx.objectStore(this.mapsStore);

    tilesStore.clear();
    mapsStore.clear();

    await this.txDone(tx);
  }

  // dodo
  async countTilesForMap(mapId: string): Promise<number> {
    const db = await this.ensureDb();
    const store = db.transaction([this.tilesStore], 'readonly').objectStore(this.tilesStore);
    const idx = store.index('byMap');
    try {
      const count = await this.promisify<number>(idx.count(IDBKeyRange.only(mapId)));
      console.log(`TileDbService.countTilesForMap: mapId=${mapId} count=${count}`);
      return count;
    } catch (err) {
      console.error('TileDbService.countTilesForMap error', err);
      return 0;
    }
  }

  async saveMapMetadata(meta: MapMetadata): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.mapsStore], 'readwrite');
    tx.objectStore(this.mapsStore).put(meta);
    await this.txDone(tx);
  }

  async getMapMetadata(id: string): Promise<MapMetadata | undefined> {
    const db = await this.ensureDb();
    const store = db.transaction([this.mapsStore], 'readonly').objectStore(this.mapsStore);
    return await this.promisify<MapMetadata | undefined>(store.get(id));
  }

  // dodo
  // async listMaps(): Promise<MapMetadata[]> {
  //   const db = await this.ensureDb();
  //   const store = db.transaction([this.mapsStore], 'readonly').objectStore(this.mapsStore);
  //   return await this.promisify<MapMetadata[]>(store.getAll());
  // }

  /**
   * Pobiera listę wszystkich metadanych map z IndexedDB.
   */
  async getMapMetadataList(): Promise<MapMetadata[]> {
    const db = await this.ensureDb();
    const store = db.transaction([this.mapsStore], 'readonly').objectStore(this.mapsStore);
    return await this.promisify<MapMetadata[]>(store.getAll());
  }

  /**
   * Aktualizuje wybrane pola w metadanych mapy.
   */
  async updateMapMetadata(id: string, updates: Partial<MapMetadata>): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.mapsStore], 'readwrite');
    const store = tx.objectStore(this.mapsStore);

    const existing = await this.promisify<MapMetadata | undefined>(store.get(id));
    if (existing) {
      const updated = { ...existing, ...updates };
      store.put(updated);
      await this.txDone(tx);
    }
  }

  /**
   * Usuwa mapę wraz z jej metadanymi.
   */
  async deleteMapWithMetadata(mapId: string): Promise<void> {
    await this.clearMap(mapId);
    const db = await this.ensureDb();
    const tx = db.transaction([this.mapsStore], 'readwrite');
    tx.objectStore(this.mapsStore).delete(mapId);
    await this.txDone(tx);
  }

  /**
   * Oblicza rozmiar mapy w bajtach (sumując rozmiary wszystkich bloków).
   */
  async getMapSize(mapId: string): Promise<number> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.tilesStore], 'readonly');
    const store = tx.objectStore(this.tilesStore);
    const idx = store.index('byMap');
    const range = IDBKeyRange.only(mapId);

    let totalSize = 0;

    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (cursor) {
          const record = cursor.value as TileRecord;
          totalSize += record.blob.size;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    return totalSize;
  }

  /**
   * Aktualizuje timestamp ostatniego dostępu do mapy.
   */
  async touchMap(mapId: string): Promise<void> {
    await this.updateMapMetadata(mapId, { lastAccessedAt: Date.now() });
  }

  /**
   * Pobiera informacje o wykorzystaniu storage API.
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number; percentage: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;
      const available = quota - usage;

      return { usage, quota, percentage, available };
    }

    // Fallback jeśli API nie jest dostępne
    return { usage: 0, quota: 0, percentage: 0, available: 0 };
  }

  /**
   * METODY ZARZĄDZANIA STANEM SESJI UCZESTNIKA
   * Zapewniają backup stanu w IndexedDB (bardziej niezawodne niż localStorage)
   */

  /**
   * Zapisuje stan sesji uczestnika w IndexedDB.
   * Używane jako backup dla localStorage - IndexedDB jest bardziej niezawodne.
   */
  async saveParticipantSession(state: Omit<ParticipantSessionState, 'id' | 'savedAt'>): Promise<void> {
    const sessionState: ParticipantSessionState = {
      id: 'current-session',
      ...state,
      savedAt: Date.now()
    };

    console.log('[TileDbService] Saving participant session to IndexedDB:', sessionState);

    const db = await this.ensureDb();
    const tx = db.transaction([this.sessionStore], 'readwrite');
    tx.objectStore(this.sessionStore).put(sessionState);
    await this.txDone(tx);

    console.log('[TileDbService] Participant session saved successfully');
  }

  /**
   * Odczytuje stan sesji uczestnika z IndexedDB.
   * Zwraca null jeśli nie ma zapisanej sesji.
   */
  async getParticipantSession(): Promise<ParticipantSessionState | null> {
    console.log('[TileDbService] Reading participant session from IndexedDB');

    const db = await this.ensureDb();
    const store = db.transaction([this.sessionStore], 'readonly').objectStore(this.sessionStore);
    const session = await this.promisify<ParticipantSessionState | undefined>(store.get('current-session'));

    if (session) {
      console.log('[TileDbService] Participant session found:', session);
      return session;
    } else {
      console.log('[TileDbService] No participant session found in IndexedDB');
      return null;
    }
  }

  /**
   * Usuwa zapisany stan sesji uczestnika z IndexedDB.
   * Wywoływane przy zakończeniu biegu lub wylogowaniu.
   */
  async clearParticipantSession(): Promise<void> {
    console.log('[TileDbService] Clearing participant session from IndexedDB');

    const db = await this.ensureDb();
    const tx = db.transaction([this.sessionStore], 'readwrite');
    tx.objectStore(this.sessionStore).delete('current-session');
    await this.txDone(tx);

    console.log('[TileDbService] Participant session cleared');
  }

  /**
   * Sprawdza czy istnieje zapisana sesja uczestnika.
   */
  async hasParticipantSession(): Promise<boolean> {
    const session = await this.getParticipantSession();
    return session !== null;
  }

  /**
   * METODY ZARZĄDZANIA GPS TRACKING POINTS
   * Uproszczone - punkty GPS są teraz minimalne (timestamp, lat, lng, accuracy)
   */

  /**
   * Zapisuje punkt GPS do IndexedDB.
   */
  async saveGpsPoint(point: GpsTrackPoint): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.gpsTracksStore], 'readwrite');
    tx.objectStore(this.gpsTracksStore).put(point);
    await this.txDone(tx);
  }

  /**
   * Pobiera wszystkie punkty GPS (dla bieżącej sesji).
   */
  async getAllGpsPoints(): Promise<GpsTrackPoint[]> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.gpsTracksStore], 'readonly');
    const store = tx.objectStore(this.gpsTracksStore);

    const points: GpsTrackPoint[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (cursor) {
          points.push(cursor.value as GpsTrackPoint);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    // Sortuj po timestamp
    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
  }

  /**
   * Pobiera punkty GPS które nie zostały jeszcze wysłane do backendu.
   */
  async getPendingGpsPoints(): Promise<GpsTrackPoint[]> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.gpsTracksStore], 'readonly');
    const store = tx.objectStore(this.gpsTracksStore);
    const index = store.index('byUploadStatus');

    const points: GpsTrackPoint[] = [];

    await new Promise<void>((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.only(false));
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (cursor) {
          points.push(cursor.value as GpsTrackPoint);
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });

    // Sortuj po timestamp
    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
  }

  /**
   * Oznacza punkty jako wysłane do backendu (po pomyślnym uploadzie).
   */
  async markGpsPointsAsUploaded(timestamps: number[]): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.gpsTracksStore], 'readwrite');
    const store = tx.objectStore(this.gpsTracksStore);

    for (const timestamp of timestamps) {
      const point = await this.promisify<GpsTrackPoint | undefined>(store.get(timestamp));
      if (point) {
        point.uploadedToBackend = true;
        store.put(point);
      }
    }

    await this.txDone(tx);
  }

  /**
   * Usuwa wszystkie punkty GPS z IndexedDB.
   * Używane po zakończeniu biegu lub przy rozpoczęciu nowej trasy.
   * UWAGA: Nie usuwa punktów z backendu - tylko z lokalnej bazy.
   */
  async clearAllGpsPoints(): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction([this.gpsTracksStore], 'readwrite');
    tx.objectStore(this.gpsTracksStore).clear();
    await this.txDone(tx);
  }

  /**
   * Zlicza wszystkie punkty GPS.
   */
  async countAllGpsPoints(): Promise<number> {
    const db = await this.ensureDb();
    const store = db.transaction([this.gpsTracksStore], 'readonly').objectStore(this.gpsTracksStore);
    return await this.promisify<number>(store.count());
  }
}