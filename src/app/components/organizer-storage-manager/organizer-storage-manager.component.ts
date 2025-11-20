import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { StorageManagerService } from '../../services/storage-manager.service';
import { TileDbService, MapMetadata } from '../../services/tile-db.service';

interface MapInfo extends MapMetadata {
  formattedSize: string;
  formattedDate: string;
}

@Component({
  selector: 'organizer-storage-manager',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    ProgressBarModule,
    TagModule,
    ConfirmDialogModule,
    ToastModule,
    TooltipModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './organizer-storage-manager.component.html',
  styleUrls: ['./organizer-storage-manager.component.scss']
})
export class OrganizerStorageManagerComponent implements OnInit {
  maps: MapInfo[] = [];
  isLoading = false;

  storageUsage = 0;
  storageQuota = 0;
  storagePercentage = 0;
  storageAvailable = 0;

  constructor(
    private storageManager: StorageManagerService,
    private tileDb: TileDbService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    try {
      // Pobierz informacje o storage
      const storageInfo = await this.storageManager.getStorageInfo();
      this.storageUsage = storageInfo.usage;
      this.storageQuota = storageInfo.quota;
      this.storagePercentage = storageInfo.percentage;
      this.storageAvailable = storageInfo.available;

      // Pobierz listę map
      const mapsList = await this.storageManager.getMapsSortedBy('size');
      console.log('[loadData] Raw maps from storage manager:', mapsList.map(m => ({id: m.id, name: m.name, isPinned: m.isPinned})));

      this.maps = mapsList.map(m => ({
        ...m,
        formattedSize: this.storageManager.formatBytes(m.sizeBytes || 0),
        formattedDate: m.downloadedAt ? new Date(m.downloadedAt).toLocaleString('pl-PL') : 'Nieznana'
      }));

      console.log('[loadData] Final maps array:', this.maps.map(m => ({id: m.id, name: m.name, isPinned: m.isPinned})));
    } catch (error) {
      console.error('Error loading storage data:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Błąd',
        detail: 'Nie udało się pobrać danych o storage'
      });
    } finally {
      this.isLoading = false;
    }
  }

  async deleteMap(mapId: string, mapName?: string) {
    this.confirmationService.confirm({
      message: `Czy na pewno chcesz usunąć mapę "${mapName || mapId}"?`,
      header: 'Potwierdzenie usunięcia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Usuń',
      rejectLabel: 'Anuluj',
      accept: async () => {
        try {
          await this.tileDb.deleteMapWithMetadata(mapId);
          this.messageService.add({
            severity: 'success',
            summary: 'Sukces',
            detail: `Mapa "${mapName || mapId}" została usunięta`
          });
          await this.loadData();
        } catch (error) {
          console.error('Error deleting map:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Błąd',
            detail: 'Nie udało się usunąć mapy'
          });
        }
      }
    });
  }

  async togglePin(map: MapInfo) {
    try {
      const newPinnedValue = !map.isPinned;
      console.log(`[togglePin] Toggling pin for map ${map.id} (${map.name}) from ${map.isPinned} to ${newPinnedValue}`);

      await this.tileDb.updateMapMetadata(map.id, { isPinned: newPinnedValue });

      console.log(`[togglePin] Successfully updated metadata for map ${map.id}`);

      this.messageService.add({
        severity: 'info',
        summary: map.isPinned ? 'Odpięto' : 'Przypięto',
        detail: `Mapa "${map.name || map.id}" ${map.isPinned ? 'nie jest już chroniona' : 'jest teraz chroniona przed usunięciem'}`
      });
      await this.loadData();
    } catch (error) {
      console.error('[togglePin] Error toggling pin:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Błąd',
        detail: 'Nie udało się zmienić statusu przypięcia'
      });
    }
  }

  async clearUnpinnedMaps() {
    console.log('[clearUnpinnedMaps] All maps:', this.maps.map(m => ({id: m.id, name: m.name, isPinned: m.isPinned})));

    const unpinnedMaps = this.maps.filter(m => !m.isPinned);

    console.log('[clearUnpinnedMaps] Unpinned maps to delete:', unpinnedMaps.map(m => ({id: m.id, name: m.name, isPinned: m.isPinned})));

    if (unpinnedMaps.length === 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Info',
        detail: 'Nie ma map do usunięcia (wszystkie są przypięte)'
      });
      return;
    }

    this.confirmationService.confirm({
      message: `Czy na pewno chcesz usunąć ${unpinnedMaps.length} niepinniętych map?`,
      header: 'Potwierdzenie czyszczenia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Usuń wszystkie',
      rejectLabel: 'Anuluj',
      accept: async () => {
        try {
          let deletedCount = 0;
          for (const map of unpinnedMaps) {
            console.log(`[clearUnpinnedMaps] Deleting map: ${map.id} (${map.name})`);
            await this.tileDb.deleteMapWithMetadata(map.id);
            deletedCount++;
            console.log(`[clearUnpinnedMaps] Successfully deleted map: ${map.id}`);
          }
          this.messageService.add({
            severity: 'success',
            summary: 'Sukces',
            detail: `Usunięto ${deletedCount} map`
          });
          await this.loadData();
        } catch (error) {
          console.error('[clearUnpinnedMaps] Error clearing maps:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Błąd',
            detail: 'Nie udało się usunąć wszystkich map'
          });
        }
      }
    });
  }

  getStorageSeverity(): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined {
    if (this.storagePercentage >= 90) return 'danger';
    if (this.storagePercentage >= 70) return 'warn';
    if (this.storagePercentage >= 50) return 'info';
    return 'success';
  }

  get formattedUsage(): string {
    return this.storageManager.formatBytes(this.storageUsage);
  }

  get formattedQuota(): string {
    return this.storageManager.formatBytes(this.storageQuota);
  }

  get formattedAvailable(): string {
    return this.storageManager.formatBytes(this.storageAvailable);
  }
}
