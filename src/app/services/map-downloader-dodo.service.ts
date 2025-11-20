import { Injectable } from '@angular/core';
import { TileDbService, MapMetadata } from './tile-db.service';

type JSZipFile = import('jszip').JSZipObject;

@Injectable({ providedIn: 'root' })
export class MapDownloaderService {
  constructor(private readonly tileDb: TileDbService) {}

  /**
   * Pobiera cały ZIP (JSZip), normalizuje ścieżki i zapisuje kafelki do IndexedDB.
   * Normalizacja ścieżek:
   *  - jeśli plik ma ścieżkę `${mapId}/z/x/y.ext` → zdejmujemy prefiks `${mapId}/` i traktujemy jako `z/x/y.ext`
   *  - jeśli plik ma ścieżkę `z/x/y.ext` → używamy jej bez zmian
   * ZAWSZE zapisujemy kafelki do IDB pod kluczem `${mapId}/${z}/${x}/${y}`, więc nie ma kolizji między mapami.
   *
   * baseUrl powinien wskazywać katalog z plikami ZIP (np. https://pub-...r2.dev/inoapp-map).
   */

  // dodo dodac pobieranie u participant
  async downloadMap(mapId: string, mapMetadata?: Partial<MapMetadata>): Promise<void> {
    // Najpierw sprawdź czy mapa już istnieje w bazie danych
    const existingTiles = await this.tileDb.hasTilesForMap(mapId);
    if (existingTiles) {
      // Aktualizuj timestamp ostatniego dostępu
      await this.tileDb.touchMap(mapId);
      return;
    }

    console.log(`Rozpoczynam pobieranie mapy ${mapId}`);
    const downloadStartTime = Date.now();
    const r2BaseUrl = 'https://pub-1c213c7ae92044b99128147a6817a38f.r2.dev'
    const zipUrl = this.buildZipUrl(r2BaseUrl, mapId);

    // 1) Pobierz cały ZIP (CORS: wystarczy Access-Control-Allow-Origin)
    const res = await fetch(zipUrl, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać ZIP: ${res.status} ${res.statusText}`);
    }
    const zipBlob = await res.blob();

    // 2) Rozpakuj ZIP
    const { default: JSZip } = await import('jszip');
    const arrayBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 3) Zbierz pliki kafelków (po normalizacji ścieżek)
    const items: Array<{ file: JSZipFile; z: number; x: number; y: number; ext: string }> = [];

    zip.forEach((fullPath: string, file: JSZipFile) => {
      if (file.dir) return;

      // Normalizacja: zdejmij prefiks `${mapId}/` jeśli występuje
      const rel = this.normalizeToZxy(fullPath, mapId);
      if (!rel) return;

      const parsed = this.parseZxy(rel);
      if (parsed) {
        items.push({ file, ...parsed });
      }
    });

    if (items.length === 0) {
      // Nic nie pasuje do struktury z/x/y.ext (po normalizacji) — kończymy bez zapisu
      console.warn(`MapDownloaderService: brak plików kafelków w ZIP dla mapy ${mapId} (items.length===0)`);
      return;
    }

    // Stabilna kolejność (opcjonalnie)
    items.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    // 4) Zapis do IndexedDB w paczkach
    const BATCH_SIZE = 200;
    const batch: Array<{ z: number; x: number; y: number; blob: Blob; contentType?: string }> = [];
    let totalSizeBytes = 0;

    for (const it of items) {
      const blob: Blob = await it.file.async('blob');
      const contentType = this.extToContentType(it.ext);

      batch.push({ z: it.z, x: it.x, y: it.y, blob, contentType });
      totalSizeBytes += blob.size;

      if (batch.length >= BATCH_SIZE) {
        await this.tileDb.putTiles(mapId, batch);
        console.log(`MapDownloaderService: zapisano batch ${BATCH_SIZE} dla mapy ${mapId}`);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      await this.tileDb.putTiles(mapId, batch);
      console.log(`MapDownloaderService: zapisano finalny batch ${batch.length} dla mapy ${mapId}`);
    }

    // 5) Zapisz metadane mapy z informacjami o rozmiarze i czasie pobrania
    const metadata: MapMetadata = {
      id: mapId,
      minZoom: mapMetadata?.minZoom || 0,
      maxZoom: mapMetadata?.maxZoom || 18,
      name: mapMetadata?.name || mapId,
      bounds: mapMetadata?.bounds,
      tms: mapMetadata?.tms,
      tileSize: mapMetadata?.tileSize,
      sizeBytes: totalSizeBytes,
      downloadedAt: downloadStartTime,
      lastAccessedAt: downloadStartTime,
      isPinned: false,
      usedInRoutes: []
    };

    await this.tileDb.saveMapMetadata(metadata);
  }

  /**
   * Formatuje rozmiar w bajtach do czytelnej formy.
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private buildZipUrl(baseUrl: string, mapId: string): string {
    const cleanBase = (baseUrl || '').replace(/\/+$/, '');
    return `${cleanBase}/${encodeURIComponent(mapId)}.zip`;
  }

  /**
   * Jeżeli ścieżka zaczyna się od `${mapId}/`, zdejmij ten prefiks.
   * W przeciwnym wypadku zwróć ścieżkę bez zmian.
   * Zwraca relatywną ścieżkę w formacie `z/x/y.ext` lub null, jeśli to nie plik kafelka.
   */
  private normalizeToZxy(fullPath: string, mapId: string): string | null {
    // Pomijamy ukryte/nie-typowe wpisy
    if (!fullPath || fullPath.endsWith('/')) return null;

    let rel = fullPath;
    const prefix = mapId + '/';
    if (fullPath.startsWith(prefix)) {
      rel = fullPath.slice(prefix.length);
    }
    // Po normalizacji oczekujemy `z/x/y.ext`
    const parts = rel.split('/');
    if (parts.length !== 3) return null;
    return rel;
  }

  /**
   * Parsuje ścieżkę `z/x/y.ext` do z/x/y oraz rozszerzenia.
   */
  private parseZxy(rel: string): { z: number; x: number; y: number; ext: string } | null {
    const parts = rel.split('/');
    if (parts.length !== 3) return null;

    const z = parseInt(parts[0], 10);
    const x = parseInt(parts[1], 10);
    const yFile = parts[2];

    const dotIdx = yFile.lastIndexOf('.');
    const yStr = dotIdx >= 0 ? yFile.slice(0, dotIdx) : yFile;
    const ext = dotIdx >= 0 ? yFile.slice(dotIdx + 1).toLowerCase() : '';
    const y = parseInt(yStr, 10);

    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { z, x, y, ext };
  }

  private extToContentType(ext: string): string {
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'webp': return 'image/webp';
      case 'avif': return 'image/avif';
      default: return 'application/octet-stream';
    }
  }
}