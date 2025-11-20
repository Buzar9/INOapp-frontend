import L from 'leaflet';
import { TileDbService } from '../services/tile-db.service';

/**
 * Warstwa kafelków z IndexedDB.
 * Użycie: const layer = idbTileLayer(tileDb, 'mapId', { minZoom: 10, maxZoom: 16, tileSize: 256 });
 * layer.addTo(map);
 */
export function idbTileLayer(
  db: TileDbService,
  mapId: string,
  options?: L.TileLayerOptions
): L.TileLayer {
  class IdbTileLayer extends L.TileLayer {
    constructor(opts?: L.TileLayerOptions) {
      // URL-template nie jest używane (nadpisujemy createTile), ale konstruktor wymaga stringa
      super('', opts);
    }

    // WAŻNE: 'override' bo nadpisujemy metodę z klasy bazowej (GridLayer/TileLayer)
    override createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const img = L.DomUtil.create('img') as HTMLImageElement;
      const size = this.getTileSize();
      img.width = size.x;
      img.height = size.y;
      img.alt = '';
      img.decoding = 'async';
      img.crossOrigin = 'anonymous';
      img.setAttribute('role', 'presentation');

      db.getTile(mapId, coords.z, coords.x, coords.y)
        .then(blob => {
          if (!blob) {
            console.warn(`[idbTileLayer] Tile not found: ${mapId}/${coords.z}/${coords.x}/${coords.y}`);
            // Możesz tu podstawić przezroczysty placeholder zamiast zgłaszać błąd
            // img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
            done(new Error(`Tile not found: ${mapId}/${coords.z}/${coords.x}/${coords.y}`), img);
            return;
          }
          const url = URL.createObjectURL(blob);
          const cleanup = () => URL.revokeObjectURL(url);
          img.onload = () => { cleanup(); done(undefined, img); };
          img.onerror = () => { cleanup(); done(new Error('Tile image error'), img); };
          img.src = url;
        })
        .catch(err => {
          console.error(`[idbTileLayer] Error loading tile ${mapId}/${coords.z}/${coords.x}/${coords.y}:`, err);
          done(err, img);
        });

      return img;
    }
  }

  return new IdbTileLayer(options);
}