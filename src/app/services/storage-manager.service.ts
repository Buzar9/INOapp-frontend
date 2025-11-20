import { Injectable } from '@angular/core';
import { TileDbService, MapMetadata } from './tile-db.service';

export interface StorageInfo {
  usage: number;           // bajty użyte
  quota: number;           // bajty limit
  percentage: number;      // % użycia
  available: number;       // bajty dostępne
  estimatedMapsCount: number;
}

export type StorageWarningLevel = 'ok' | 'warning' | 'critical';

@Injectable({ providedIn: 'root' })
export class StorageManagerService {
  // Limity dla poziomów ostrzeżeń
  private readonly WARNING_THRESHOLD = 70;  // 70% wypełnienia
  private readonly CRITICAL_THRESHOLD = 90; // 90% wypełnienia

  constructor(private tileDb: TileDbService) {}

  /**
   * Pobiera informacje o wykorzystaniu storage.
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const estimate = await this.tileDb.getStorageEstimate();
    const mapsList = await this.tileDb.getMapMetadataList();

    return {
      ...estimate,
      estimatedMapsCount: mapsList.length
    };
  }

  /**
   * Sprawdza czy można pobrać mapę o danym rozmiarze.
   */
  async canDownloadMap(estimatedSizeBytes: number): Promise<boolean> {
    const info = await this.getStorageInfo();

    // Jeśli quota jest 0 (API niedostępne), zakładamy że można
    if (info.quota === 0) {
      return true;
    }

    return info.available >= estimatedSizeBytes;
  }

  /**
   * Sprawdza czy wymagane jest czyszczenie cache.
   */
  async needsCleanup(): Promise<boolean> {
    const info = await this.getStorageInfo();
    return info.percentage >= this.WARNING_THRESHOLD;
  }

  /**
   * Zwraca poziom ostrzeżenia o zapełnieniu storage.
   */
  async getStorageWarningLevel(): Promise<StorageWarningLevel> {
    const info = await this.getStorageInfo();

    if (info.percentage >= this.CRITICAL_THRESHOLD) {
      return 'critical';
    } else if (info.percentage >= this.WARNING_THRESHOLD) {
      return 'warning';
    }

    return 'ok';
  }

  /**
   * Sugeruje mapy do usunięcia aby zwolnić określoną ilość miejsca.
   * Zwraca posortowaną listę ID map (od najstarszych, niepinnowanych).
   */
  async suggestMapsToRemove(bytesNeeded: number): Promise<string[]> {
    const allMaps = await this.tileDb.getMapMetadataList();

    // Filtruj tylko niepinnowane mapy
    const removableMaps = allMaps.filter(m => !m.isPinned);

    // Sortuj po lastAccessedAt (najstarsze pierwsze), potem po downloadedAt
    removableMaps.sort((a, b) => {
      const aTime = a.lastAccessedAt || a.downloadedAt || 0;
      const bTime = b.lastAccessedAt || b.downloadedAt || 0;
      return aTime - bTime;
    });

    // Wybierz tyle map, ile potrzeba do zwolnienia miejsca
    const toRemove: string[] = [];
    let freedBytes = 0;

    for (const map of removableMaps) {
      if (freedBytes >= bytesNeeded) {
        break;
      }
      toRemove.push(map.id);
      freedBytes += map.sizeBytes || 0;
    }

    return toRemove;
  }

  /**
   * Wykonuje automatyczne czyszczenie - usuwa niepinnowane, najstarsze mapy
   * dopóki nie zwolni się wystarczająco miejsca.
   * Zwraca listę usuniętych map.
   */
  async performAutoCleanup(): Promise<string[]> {
    const info = await this.getStorageInfo();

    // Cel: zejść poniżej 60% zapełnienia
    const targetPercentage = 60;
    const targetUsage = (info.quota * targetPercentage) / 100;
    const bytesToFree = Math.max(0, info.usage - targetUsage);

    if (bytesToFree === 0) {
      return [];
    }

    const mapsToRemove = await this.suggestMapsToRemove(bytesToFree);
    const removed: string[] = [];

    for (const mapId of mapsToRemove) {
      try {
        await this.tileDb.deleteMapWithMetadata(mapId);
        removed.push(mapId);
        console.log(`StorageManager: Auto-removed map ${mapId}`);
      } catch (err) {
        console.error(`StorageManager: Failed to remove map ${mapId}`, err);
      }
    }

    return removed;
  }

  /**
   * Formatuje rozmiar w bajtach do czytelnej formy (KB, MB, GB).
   */
  formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Pobiera listę wszystkich map z metadanymi posortowaną według różnych kryteriów.
   */
  async getMapsSortedBy(sortBy: 'size' | 'name' | 'date'): Promise<MapMetadata[]> {
    const maps = await this.tileDb.getMapMetadataList();

    switch (sortBy) {
      case 'size':
        return maps.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
      case 'name':
        return maps.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      case 'date':
        return maps.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
      default:
        return maps;
    }
  }
}
