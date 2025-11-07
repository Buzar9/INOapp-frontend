import { Injectable } from '@angular/core';

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
  private tilesStore = 'tiles';
  private mapsStore = 'maps';

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
          const req = indexedDB.open(this.dbName);

          req.onupgradeneeded = () => {
            const db = req.result;
            console.log('TileDbService: onupgradeneeded - creating object stores');
            if (!db.objectStoreNames.contains(this.tilesStore)) {
              const tiles = db.createObjectStore(this.tilesStore, { keyPath: 'key' });
              tiles.createIndex('byMap', 'mapId', { unique: false });
              tiles.createIndex('byMapZ', ['mapId', 'z'], { unique: false });
            }
            if (!db.objectStoreNames.contains(this.mapsStore)) {
              db.createObjectStore(this.mapsStore, { keyPath: 'id' });
            }
          };

          req.onsuccess = () => {
            const db = req.result;
            // If stores are missing for some reason (old DB), perform an upgrade by reopening with higher version
            const hasTiles = db.objectStoreNames.contains(this.tilesStore);
            const hasMaps = db.objectStoreNames.contains(this.mapsStore);
            if (hasTiles && hasMaps) {
              resolve(db);
              return;
            }

            const newVersion = (db.version || 0) + 1;
            console.warn(`TileDbService: object stores missing (tiles:${hasTiles} maps:${hasMaps}), upgrading DB to v${newVersion}`);
            db.close();

            const req2 = indexedDB.open(this.dbName, newVersion);
            req2.onupgradeneeded = () => {
              const db2 = req2.result;
              console.log('TileDbService: onupgradeneeded (forced) - creating missing object stores');
              if (!db2.objectStoreNames.contains(this.tilesStore)) {
                const tiles = db2.createObjectStore(this.tilesStore, { keyPath: 'key' });
                tiles.createIndex('byMap', 'mapId', { unique: false });
                tiles.createIndex('byMapZ', ['mapId', 'z'], { unique: false });
              }
              if (!db2.objectStoreNames.contains(this.mapsStore)) {
                db2.createObjectStore(this.mapsStore, { keyPath: 'id' });
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
}