import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';

import { TileDbService } from '../../services/tile-db.service';

type FileWithRel = File & { webkitRelativePath?: string };

@Component({
  selector: 'organizer-background-map-import',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, ProgressBarModule],
  templateUrl: './organizer-background-map-import.component.html'
})
export class OrganizerBackgroundMapImportComponent {
  mapId = '';

  progress = { total: 0, imported: 0, skipped: 0, errors: 0, step: '' };
  get progressPercent(): number {
    if (!this.progress.total) return 0;
    return Math.round((this.progress.imported / this.progress.total) * 100);
  }

  statusMessage = '';
  busy = false;

  constructor(private tileDb: TileDbService) {}

  // File System Access API (Chromium)
  async pickDirectory() {
    const picker: any = (window as any).showDirectoryPicker;
    if (!picker) {
      alert('Ta przeglądarka nie wspiera wyboru katalogu (File System Access API). Użyj fallbacku poniżej.');
      return;
    }
    if (!this.mapId) {
      alert('Podaj ID mapy.');
      return;
    }

    try {
      this.resetProgress();
      this.busy = true;
      const dirHandle = await picker();

      const files: { rel: string[]; file: File }[] = [];
      const walk = async (handle: any, path: string[] = []) => {
        for await (const [name, entry] of handle.entries()) {
          if (entry.kind === 'directory') {
            await walk(entry, [...path, name]);
          } else if (entry.kind === 'file') {
            const file = await entry.getFile();
            files.push({ rel: path, file });
          }
        }
      };
      await walk(dirHandle);

      await this.importCommon(this.mapId, files.map(f => ({
        parts: [...f.rel, f.file.name],
        getBlob: async () => f.file
      })));

      this.statusMessage = `Zakończono import mapy "${this.mapId}".`;
    } catch (e) {
      console.error(e);
      this.statusMessage = 'Błąd podczas importu z katalogu.';
    } finally {
      this.busy = false;
    }
  }

  // Fallback: natywny <input type="file" webkitdirectory>
  async onDirInputChange(ev: Event) {
    if (!this.mapId) {
      alert('Podaj ID mapy.');
      const input = ev.target as HTMLInputElement;
      input.value = '';
      return;
    }

    try {
      this.resetProgress();
      this.busy = true;

      const input = ev.target as HTMLInputElement;
      const files = Array.from(input.files || []) as FileWithRel[];
      if (!files.length) return;

      const items = files.map(file => {
        const relPath = file.webkitRelativePath || file.name;
        const parts = relPath.split('/').filter(Boolean);
        return { parts, getBlob: async () => file };
      });

      await this.importCommon(this.mapId, items);
      this.statusMessage = `Zakończono import mapy "${this.mapId}".`;
    } catch (err) {
      console.error(err);
      this.statusMessage = 'Błąd podczas importu plików.';
    } finally {
      const input = ev.target as HTMLInputElement;
      input.value = ''; // reset wyboru
      this.busy = false;
    }
  }

  async clearMap() {
    if (!this.mapId) {
      alert('Podaj ID mapy do wyczyszczenia.');
      return;
    }
    if (!confirm(`Usunąć wszystkie kafelki dla mapy "${this.mapId}" z IndexedDB?`)) return;

    await this.tileDb.clearMap(this.mapId);
    this.statusMessage = `Usunięto kafelki dla mapy "${this.mapId}".`;
  }

  // --- Import wspólny ---
  private async importCommon(
    mapId: string,
    items: Array<{ parts: string[]; getBlob: () => Promise<Blob> }>
  ) {
    const candidates = items.filter(i =>
      /\.(png|jpg|jpeg|webp)$/i.test(i.parts[i.parts.length - 1])
    );

    this.progress = {
      total: candidates.length,
      imported: 0,
      skipped: 0,
      errors: 0,
      step: 'Import do IndexedDB...'
    };

    const batchSize = 400;
    let batch: Array<{ z: number; x: number; y: number; blob: Blob; contentType?: string }> = [];

    const flush = async () => {
      if (!batch.length) return;
      await this.tileDb.putTiles(mapId, batch);
      this.progress.imported += batch.length;
      batch = [];
      await new Promise(r => setTimeout(r)); // pozwól UI odświeżyć się
    };

    for (const item of candidates) {
      const parsed = this.parseZXY(item.parts);
      if (!parsed) {
        this.progress.skipped++;
        continue;
      }
      try {
        const blob = await item.getBlob();
        batch.push({
          ...parsed,
          blob,
          contentType: (blob as any).type || this.guessContentType(item.parts[item.parts.length - 1])
        });
        if (batch.length >= batchSize) await flush();
      } catch (e) {
        console.error(e);
        this.progress.errors++;
      }
    }
    await flush();

    this.progress.step = 'Zakończono zapis do IndexedDB.';
  }

  private parseZXY(parts: string[]): { z: number; x: number; y: number } | null {
    if (parts.length < 3) return null;
    const [zStr, xStr, yFile] = parts.slice(-3);
    const yStr = yFile.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const z = Number(zStr), x = Number(xStr), y = Number(yStr);
    if ([z, x, y].some(n => !Number.isFinite(n))) return null;
    return { z, x, y };
  }

  private guessContentType(filename: string): string {
    if (/\.png$/i.test(filename)) return 'image/png';
    if (/\.jpe?g$/i.test(filename)) return 'image/jpeg';
    if (/\.webp$/i.test(filename)) return 'image/webp';
    return 'application/octet-stream';
  }

  private resetProgress() {
    this.progress = { total: 0, imported: 0, skipped: 0, errors: 0, step: '' };
    this.statusMessage = '';
  }
}