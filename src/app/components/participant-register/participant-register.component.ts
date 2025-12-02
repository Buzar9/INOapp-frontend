import { Component } from "@angular/core";
import { ParticipantSendService } from "../../services/participant-send-service";
import { ParticipantStateService } from "../../services/participant-state.service";
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { QrScannerComponent } from "../qr-scanner/qr-scanner.component";
import { CommonModule } from "@angular/common";
import { MapDownloaderService } from "../../services/map-downloader-dodo.service";
import { TileDbService } from "../../services/tile-db.service";
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';


@Component({
    selector: 'participant-register',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        QrScannerComponent,
        CommonModule,
        ButtonModule,
        InputTextModule,
        ProgressSpinnerModule
    ],
    templateUrl: './participant-register.component.html',
    styleUrl: './participant-register.component.css'
})
export class ParticipantRegisterComponent {
    showScanner: boolean = false;
    showForm: boolean = false;
    isLoading: boolean = false;
    participantForm: FormGroup

    constructor(
        private participantSendService: ParticipantSendService,
        private participantStateService: ParticipantStateService,
        private mapDownloader: MapDownloaderService,
        private tileDbService: TileDbService,
        private router: Router,
        private formBuilder: FormBuilder,) {
            this.participantForm = this.formBuilder.group({
            participantName: ['']
        })
        }

    toggleScanner() {
        this.showScanner = !this.showScanner;
    }

    async receiveInitScan(scan: string) {
        this.showScanner = false;
        this.showForm = true

        let parsedScan = JSON.parse(scan);

        this.participantStateService.setOrganizationData({
            competitionId: parsedScan.competitionId,
            categoryId: parsedScan.categoryId,
            participantUnit: parsedScan.participantUnitName
        })
    }
// dodo przy skanowaniu inita nie pobierac zdjecia z aparatu
    onSubmit() {
        this.isLoading = true;

        this.clearOldRunData();

        this.participantStateService.setParticipantName(this.participantForm.value)
        let formData = this.participantStateService.getData()

        let request =  {
            competitionId: formData.competitionId,
            categoryId: formData.categoryId,
            participantName: formData.participantName,
            participantUnitName: formData.participantUnit
        }

        this.participantSendService.initiateRun(request).subscribe ({
            next: async (response) => {
                console.log('[ParticipantRegister] Run initiated successfully:', response);

                // Zapisz wszystkie dane sesji do localStorage
                this.setLocalStorageItem('runId', response.runId);
                this.setLocalStorageItem('categoryId', formData.categoryId);
                this.setLocalStorageItem('competitionId', formData.competitionId);
                this.setLocalStorageItem('participantUnit', formData.participantUnit);
                this.setLocalStorageItem('participantName', formData.participantName);

                // Ustaw runId w serwisie stanu
                this.participantStateService.setRunId(response.runId);

                // Zapisz backup stanu do IndexedDB (początkowy stan przed rozpoczęciem biegu)
                try {
                    await this.tileDbService.saveParticipantSession({
                        runId: response.runId,
                        categoryId: formData.categoryId,
                        competitionId: formData.competitionId,
                        participantUnit: formData.participantUnit,
                        participantName: formData.participantName,
                        wasRunActivate: false,
                        isRunFinished: false,
                        runStartTime: 0,
                        raceTimeDisplay: '00:00',
                        checkpointsNumber: 0,
                        pendingRequests: []
                    });
                } catch (err) {
                    console.error('[ParticipantRegister] Error saving session backup:', err);
                }

                try {
                    await this.mapDownloader.downloadMap(response.backgroundMapId)
                    this.router.navigate(['/participant/scan']);
                } catch (error) {
                    console.error('[ParticipantRegister] Error downloading map:', error);
                } finally {
                    this.isLoading = false;
                }
            },
            error: (err) => {
                console.error('[ParticipantRegister] Error initiating run:', err)
                this.isLoading = false;
            }
        })
    }

    private clearOldRunData(): void {
        const keysToRemove = ['wasRunActivate', 'isRunFinished', 'raceTimeDisplay', 'runStartTime', 'checkpointsNumber', 'pendingRequests'];
        keysToRemove.forEach(key => {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        });
    }

    private setLocalStorageItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  }
}

export type RegisterScan = {
    competitionId: string,
    categoryId: string,
    participantUnitName: string
}
