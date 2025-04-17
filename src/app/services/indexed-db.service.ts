// import { Injectable } from '@angular/core';
// import { openDB, IDBPDatabase } from 'idb';

// export interface QRData {
//   id?: number;
//   code: string;
//   timestamp: number;
//   location: { lat: number, lng: number };
//   synced: boolean;
//   nickname: string | null;
//   route: string | null;
//   eventType: string; // "start", "finish", "checkpoint"
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class IndexedDBService {
//   private dbPromise: Promise<IDBPDatabase>;

//   constructor() {
//     this.dbPromise = openDB('INOappDB', 1, {
//       upgrade(db) {
//         if (!db.objectStoreNames.contains('qrData')) {
//           const store = db.createObjectStore('qrData', { keyPath: 'id', autoIncrement: true });
//           store.createIndex('synced', 'synced');
//         }
//       }
//     });
//   }

//   async addQRData(data: QRData): Promise<number> {
//     const db = await this.dbPromise;
//     data.synced = false;
//     return db.add('qrData', data);
//   }

//   async getUnsyncedData(): Promise<QRData[]> {
//     const db = await this.dbPromise;
//     return db.getAllFromIndex('qrData', 'synced', false);
//   }

//   async markAsSynced(id: number): Promise<void> {
//     const db = await this.dbPromise;
//     const data = await db.get('qrData', id);
//     if (data) {
//       data.synced = true;
//       await db.put('qrData', data);
//     }
//   }
// }
