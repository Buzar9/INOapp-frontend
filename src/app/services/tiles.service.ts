import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TileService {
  private mbtilesBuffer!: Uint8Array;
  private SQL!: SqlJsStatic;

  /** Wczytujemy i przechowujemy bufor, ale nie tworzmy DB jeszcze */
  async init(): Promise<void> {
    const response = await fetch('assets/tiles.mbtiles');
    const arrayBuffer = await response.arrayBuffer();
    this.mbtilesBuffer = new Uint8Array(arrayBuffer);

    this.SQL = await initSqlJs({ locateFile: () => 'assets/sql-wasm.wasm' });
    console.log('SQL.js gotowy, bufor MBTiles w pamięci');
  }

  /** Za każdym razem tworzymy świeżą bazę i pytamy o kafelek */
  getTile(z: number, x: number, y: number): Uint8Array | null {
    // Utworzenie czystej instancji bazy
    const db = new this.SQL.Database(this.mbtilesBuffer);

    // TMS -> XYZ
    const flippedY = (1 << z) - 1 - y;
    const stmt = db.prepare(`
      SELECT tile_data FROM tiles
      WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
    `);
    stmt.bind([z, x, flippedY]);

    let tile: Uint8Array | null = null;
    if (stmt.step()) {
      tile = stmt.getAsObject()['tile_data'] as Uint8Array;
    }
    stmt.free();
    db.close();
    return tile;
  }
}

