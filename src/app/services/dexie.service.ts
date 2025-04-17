import { Component, Injectable, NgModule } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Station } from '../utils/StationScan';

// Define the interface for QRData (same as before)

@Injectable({
  providedIn: 'root'
})
export class DexieService extends Dexie {
  // Declare a table for storing QRData, with primary key id
  public qrData!: Table<Station, number>;

  constructor() {
    super('INOappDB');
    // Define the database schema; ++id means auto-increment primary key.
    // Add synced as an indexed field for better querying
    this.version(1).stores({
      qrData: '++id, synced, code' // Adding `synced` as an index
    });
  }

  /**
   * Add QR data to the database.
   * @param data QRData to be added.
   * @returns Promise<number> - The id of the inserted record.
   */
  async addQRData(data: Station): Promise<number> {
    data.synced = false;
    return this.qrData.add(data);
  }

  /**
   * Retrieve all QRData entries that have not been synced.
   * @returns Promise<QRData[]> - Array of unsynced QRData.
   */
  async getUnsyncedData(): Promise<Station[]> {
    // Use indexed query on `synced`
    return this.qrData.where('synced').equals(0).toArray();
  }

  /**
   * Mark a specific QRData entry as synced.
   * @param id The id of the record to mark as synced.
   * @returns Promise<void>
   */
  async markAsSynced(id: number): Promise<void> {
    // Correct use of update
    await this.qrData.update(id, { synced: true });
  }
}
