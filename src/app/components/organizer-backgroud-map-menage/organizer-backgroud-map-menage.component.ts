import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { SplitterModule } from 'primeng/splitter';
import { TableModule, TableRowExpandEvent, TableRowCollapseEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { AutoFocusModule } from 'primeng/autofocus';
import { TileDbService } from '../../services/tile-db.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

@Component({
    selector:'organizer-backgroud-map-menage',
    standalone:true,
    imports:[
        CommonModule,
        ReactiveFormsModule,
        InputTextModule,
        ButtonModule,
        FileUploadModule,
        ProgressBarModule,
        TagModule,
        ProgressSpinnerModule,
        BackofficeMapComponent,
        SplitterModule,
        TableModule,
        TooltipModule,
        DialogModule,
        AutoFocusModule,
        ConfirmDialogModule
    ],
    providers: [ConfirmationService],
    templateUrl: './organizer-backgroud-map-menage.component.html',
    styleUrl: './organizer-backgroud-map-menage.component.css'
})
export class OrganizerBackgroudMapMenageComponent implements OnInit {
    @ViewChild(BackofficeMapComponent)
    mapComponent!: BackofficeMapComponent;

    uploadForm: FormGroup;
    uploadProgress: number = 0;
    uploadMessage: string = '';
    backgroundMaps: BackgroundMap[] = [];
    isLoading: boolean = false;
    selectedMapForPreview?: BackgroundMap;
    expandedMaps: { [key: string]: boolean } = {};
    isMapFullscreen: boolean = false;
    showAddMapForm: boolean = false;

    constructor(
        private formBuilder: FormBuilder,
        private backofficeService: BackofficeSendService,
        private tileDbService: TileDbService,
        private confirmationService: ConfirmationService
    ) {
        this.uploadForm = this.formBuilder.group({
        name: [''],
        minZoom: [12],
        maxZoom: [16]
        });
    }

    ngOnInit(): void {
        this.loadBackgroundMaps();
    }

    loadBackgroundMaps(clearSelection: boolean = false): void {
        this.isLoading = true;
        const request = { competitionId: 'Competition123' };
        this.backofficeService.getBackgroundMaps(request).subscribe({
            next: (maps) => {
                this.backgroundMaps = maps;

                if (clearSelection || !this.selectedMapForPreview ||
                    !maps.find(m => m.id === this.selectedMapForPreview?.id)) {
                    this.selectedMapForPreview = undefined;
                    this.expandedMaps = {};
                    if (maps.length > 0) {
                        this.selectMap(maps[0]);
                    }
                }

                this.isLoading = false;
            },
            error: (err) => {
                console.error(err);
                this.isLoading = false;
            }
        });
    }

    getMapBounds(map: BackgroundMap): string {
        return `NE: [${map.northEast[0].toFixed(4)}, ${map.northEast[1].toFixed(4)}] SW: [${map.southWest[0].toFixed(4)}, ${map.southWest[1].toFixed(4)}]`;
    }

    onAddMapClick(): void {
        this.showAddMapForm = true;
        this.uploadForm.reset({ minZoom: 12, maxZoom: 16 });
        this.uploadMessage = '';
        this.uploadProgress = 0;
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

    onMapExpand(event: TableRowExpandEvent): void {
        this.selectMap(event.data);
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
            this.uploadMessage = 'Wybierz plik!';
            return;
        }

        if (file.type !== 'image/tiff') {
            this.uploadMessage = 'Dozwolony jest tylko format GeoTIFF (image/tiff).';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const metadata = {
            name: this.uploadForm.value.name,
            minZoom: this.uploadForm.value.minZoom,
            maxZoom: this.uploadForm.value.maxZoom,
        };

        this.backofficeService.uploadBackgroundMap(file, metadata).subscribe({
            next: (event: HttpEvent<any>) => {
                if (event.type === HttpEventType.UploadProgress && event.total) {
                    this.uploadProgress = Math.round((100 * event.loaded) / event.total);
                } else if (event.type === HttpEventType.Response) {
                    this.uploadMessage = 'Plik został pomyślnie przesłany!';
                    this.uploadProgress = 0;
                    this.uploadForm.reset({ minZoom: 12, maxZoom: 16 });
                    this.showAddMapForm = false;
                    this.loadBackgroundMaps();
                }
            },
            error: (err) => {
                this.uploadMessage = 'Wystąpił błąd podczas przesyłania pliku.';
                this.uploadProgress = 0;
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
                    await this.tileDbService.clearMap(mapId);
                } catch (err) {
                    console.error(err);
                }

                this.backofficeService.deleteBackgroundMap(request).subscribe({
                    next: () => {
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
