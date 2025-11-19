import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { SplitterModule } from 'primeng/splitter';
import { TableModule, TableRowExpandEvent, TableRowCollapseEvent } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { AutoFocusModule } from 'primeng/autofocus';

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
        AutoFocusModule
    ],
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
        private backofficeService: BackofficeSendService
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

    loadBackgroundMaps(): void {
        this.isLoading = true;
        const request = { competitionId: 'Competition123' };
        this.backofficeService.getBackgroundMaps(request).subscribe({
            next: (maps) => {
                this.backgroundMaps = maps;
                if (maps.length > 0 && !this.selectedMapForPreview) {
                    this.selectMap(maps[0]);
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Błąd podczas pobierania map:', err);
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

    onDeleteMap(mapId: string): void {
        this.isLoading = true;
        const request = {
            backgroundMapId: mapId
        }
        this.backofficeService.deleteBackgroundMap(request).subscribe({
            next: () => {
                this.loadBackgroundMaps();
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Błąd podczas usuwania mapy:', err);
                this.isLoading = false;
            }
        });
    }
}
