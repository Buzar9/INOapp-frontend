import { Component } from "@angular/core";
import { ParticipantSendService } from "../../services/participant-send-service";
import { ParticipantStateService } from "../../services/participant-state.service";
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { QrScannerComponent } from "../qr-scanner/qr-scanner.component";
import { CommonModule } from "@angular/common";
import { MapDownloaderService } from "../../services/map-downloader-dodo.service";
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



    // dodo qr do podgladu mapy na trasie po zakonczonym biegu

    onSubmit() {
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
                // Włącz loading podczas pobierania mapy
                this.isLoading = true;
                
                this.setLocalStorageItem('categoryId', formData.categoryId)
                this.setLocalStorageItem('runId', response.runId)
                
                try {
                    await this.mapDownloader.downloadMap(response.backgroundMapId)
                    this.router.navigate(['/participant/scan']);
                    console.log('dodo response', response)
                } catch (error) {
                    console.error('Błąd podczas pobierania mapy:', error);
                } finally {
                    // Wyłącz loading niezależnie od wyniku
                    this.isLoading = false;
                }
            },
            error: (err) => {
                console.log('dodo error', err)
                this.isLoading = false;
            }
        })
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