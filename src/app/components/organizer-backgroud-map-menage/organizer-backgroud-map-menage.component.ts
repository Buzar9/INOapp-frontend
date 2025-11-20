import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { FileUploadModule } from 'primeng/fileupload';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { SplitterModule } from 'primeng/splitter';
import { TableModule, TableRowExpandEvent, TableRowCollapseEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { AutoFocusModule } from 'primeng/autofocus';
import { TileDbService } from '../../services/tile-db.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { StorageManagerService } from '../../services/storage-manager.service';
import { MapDownloaderService } from '../../services/map-downloader-dodo.service';
import { ToastModule } from 'primeng/toast';

@Component({
    selector:'organizer-backgroud-map-menage',
    standalone:true,
    imports:[
        CommonModule,
        ReactiveFormsModule,
        InputTextModule,
        ButtonModule,
        FileUploadModule,
        TagModule,
        ProgressSpinnerModule,
        ProgressBarModule,
        BackofficeMapComponent,
        SplitterModule,
        TableModule,
        TooltipModule,
        DialogModule,
        AutoFocusModule,
        ConfirmDialogModule,
        ToastModule
    ],
    providers: [ConfirmationService, MessageService],
    templateUrl: './organizer-backgroud-map-menage.component.html',
    styleUrl: './organizer-backgroud-map-menage.component.css'
})
export class OrganizerBackgroudMapMenageComponent implements OnInit {
    @ViewChild(BackofficeMapComponent)
    mapComponent!: BackofficeMapComponent;

    uploadForm: FormGroup;
    backgroundMaps: BackgroundMap[] = [];
    isLoading: boolean = false;
    isUploading: boolean = false;
    selectedMapForPreview?: BackgroundMap;
    expandedMaps: { [key: string]: boolean } = {};
    isMapFullscreen: boolean = false;
    showAddMapForm: boolean = false;

    // Storage info
    storageUsage = 0;
    storageQuota = 0;
    storagePercentage = 0;
    storageAvailable = 0;

    constructor(
        private formBuilder: FormBuilder,
        private backofficeService: BackofficeSendService,
        private tileDbService: TileDbService,
        private confirmationService: ConfirmationService,
        private storageManager: StorageManagerService,
        private mapDownloader: MapDownloaderService,
        private messageService: MessageService
    ) {
        this.uploadForm = this.formBuilder.group({
        name: [''],
        minZoom: [12],
        maxZoom: [16]
        });
    }

    async ngOnInit(): Promise<void> {
        await this.updateStorageInfo();
        this.loadBackgroundMaps();
    }

    loadBackgroundMaps(clearSelection: boolean = false): void {
        const request = { competitionId: 'Competition123' };
        this.backofficeService.getBackgroundMaps(request).subscribe({
            next: (maps) => {
                this.backgroundMaps = maps;

                if (clearSelection || !this.selectedMapForPreview ||
                    !maps.find(m => m.id === this.selectedMapForPreview?.id)) {
                    this.selectedMapForPreview = undefined;
                    this.expandedMaps = {};
                }
            },
            error: (err) => {
                console.error(err);
            }
        });
    }

    private async updateStorageInfo(): Promise<void> {
        try {
            const info = await this.storageManager.getStorageInfo();
            this.storageUsage = info.usage;
            this.storageQuota = info.quota;
            this.storagePercentage = info.percentage;
            this.storageAvailable = info.available;
        } catch (err) {
            console.error('Error updating storage info:', err);
        }
    }

    private async downloadSingleMap(map: BackgroundMap): Promise<void> {
        console.log(`[downloadSingleMap] Starting download for map: ${map.id}`);

        const warningLevel = await this.storageManager.getStorageWarningLevel();

        // Jeśli pamięć jest krytyczna, nie pobieraj
        if (warningLevel === 'critical') {
            console.warn('[downloadSingleMap] Critical storage level - skipping download');
            this.messageService.add({
                severity: 'warn',
                summary: 'Mało miejsca w pamięci',
                detail: `Pamięć zapełniona w ${this.storagePercentage.toFixed(1)}%. Nie można pobrać mapy.`,
                life: 5000
            });
            return;
        }

        if (warningLevel === 'warning') {
            console.warn('[downloadSingleMap] Warning storage level');
            this.messageService.add({
                severity: 'info',
                summary: 'Ograniczona pamięć',
                detail: `Dostępne: ${this.storageManager.formatBytes(this.storageAvailable)}. Pobieranie mapy...`,
                life: 3000
            });
        }

        // Pobierz mapę
        this.isLoading = true;
        try {
            console.log(`[downloadSingleMap] Downloading map: ${map.id}`);

            await this.mapDownloader.downloadMap(map.id, {
                name: map.name,
                minZoom: map.minZoom,
                maxZoom: map.maxZoom,
                bounds: {
                    north: map.northEast[0],
                    east: map.northEast[1],
                    south: map.southWest[0],
                    west: map.southWest[1]
                }
            });

            console.log(`[downloadSingleMap] Successfully downloaded: ${map.id}`);

            // Aktualizuj storage info po pobraniu
            await this.updateStorageInfo();

            if (warningLevel === 'ok') {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Mapa pobrana',
                    detail: `Mapa "${map.name}" została pobrana do pamięci offline`,
                    life: 3000
                });
            }
        } catch (err) {
            console.error(`[downloadSingleMap] Failed to download ${map.id}:`, err);
            this.messageService.add({
                severity: 'error',
                summary: 'Błąd pobierania',
                detail: `Nie udało się pobrać mapy "${map.name}"`,
                life: 5000
            });
        } finally {
            this.isLoading = false;
            console.log('[downloadSingleMap] Finished');
        }
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

    getStorageSeverity(): 'success' | 'info' | 'warn' | 'danger' {
        if (this.storagePercentage >= 90) return 'danger';
        if (this.storagePercentage >= 70) return 'warn';
        if (this.storagePercentage >= 50) return 'info';
        return 'success';
    }

    getMapBounds(map: BackgroundMap): string {
        return `NE: [${map.northEast[0].toFixed(4)}, ${map.northEast[1].toFixed(4)}] SW: [${map.southWest[0].toFixed(4)}, ${map.southWest[1].toFixed(4)}]`;
    }

    onAddMapClick(): void {
        this.showAddMapForm = true;
        this.uploadForm.reset({ minZoom: 12, maxZoom: 16 });
    }

    toggleMapExpand(map: BackgroundMap): void {
        const isExpanded = this.expandedMaps[map.id];
        if (isExpanded) {
            delete this.expandedMaps[map.id];
        } else {
            this.expandedMaps = { [map.id]: true };
            this.selectMap(map);
        }
    }

    async onMapExpand(event: TableRowExpandEvent): Promise<void> {
        const map: BackgroundMap = event.data;

        await this.downloadSingleMap(map);

        this.selectMap(map);
    }

    onMapCollapse(event: TableRowCollapseEvent): void {
        if (this.selectedMapForPreview?.id === event.data.id) {
            this.selectedMapForPreview = undefined;
        }
    }

    private selectMap(map: BackgroundMap): void {
        this.expandedMaps = { [map.id]: true };
        this.selectedMapForPreview = map;
    }

    isMapSelected(mapId: string): boolean {
        return this.selectedMapForPreview?.id === mapId;
    }

    toggleMapFullscreen(): void {
        this.isMapFullscreen = !this.isMapFullscreen;

        setTimeout(() => {
            if (this.mapComponent) {
                this.mapComponent.invalidateSizeAndKeepCenter();
            }
        }, 100);
    }

    onUpload(event: any): void {
        const file: File = event.files[0];

        if (!file) {
            return;
        }

        if (file.type !== 'image/tiff') {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const metadata = {
            name: this.uploadForm.value.name,
            minZoom: this.uploadForm.value.minZoom,
            maxZoom: this.uploadForm.value.maxZoom,
        };

        this.showAddMapForm = false;
        this.isUploading = true;
        this.uploadForm.reset({ minZoom: 12, maxZoom: 16 });

        this.backofficeService.uploadBackgroundMap(file, metadata).subscribe({
            next: (event: HttpEvent<any>) => {
                if (event.type === HttpEventType.Response) {
                    this.isUploading = false;

                    const request = { competitionId: 'Competition123' };
                    this.backofficeService.getBackgroundMaps(request).subscribe({
                        next: (maps) => {
                            this.backgroundMaps = maps;

                            if (maps.length > 0) {
                                const lastMap = maps[maps.length - 1];
                                this.selectMap(lastMap);
                            }
                        },
                        error: (err) => {
                            console.error(err);
                        }
                    });
                }
            },
            error: (err) => {
                this.isUploading = false;
                console.error('Error uploading file:', err);
            }
        });
    }

    async onDeleteMap(mapId: string): Promise<void> {
        const map = this.backgroundMaps.find(m => m.id === mapId);
        const mapName = map?.name || 'tę mapę';

        this.confirmationService.confirm({
            message: `Czy na pewno chcesz usunąć mapę "${mapName}"?`,
            header: 'Potwierdzenie usunięcia',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Tak',
            rejectLabel: 'Nie',
            accept: async () => {
                this.isLoading = true;

                if (this.selectedMapForPreview?.id === mapId) {
                    this.selectedMapForPreview = undefined;
                    this.expandedMaps = {};
                }

                const request = {
                    backgroundMapId: mapId
                }

                try {
                    await this.tileDbService.deleteMapWithMetadata(mapId);
                } catch (err) {
                    console.error(err);
                }

                this.backofficeService.deleteBackgroundMap(request).subscribe({
                    next: async () => {
                        await this.updateStorageInfo();
                        this.loadBackgroundMaps(true);
                    },
                    error: (err) => {
                        console.error(err);
                        this.isLoading = false;
                    }
                });
            }
        });
    }
}
