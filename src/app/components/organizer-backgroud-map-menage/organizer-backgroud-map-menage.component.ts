import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

@Component({
    selector:'organizer-backgroud-map-menage',
    standalone:true,
    imports:[    
        CommonModule,
        ReactiveFormsModule,
        InputTextModule,
        ButtonModule,
        FileUploadModule,
        ProgressBarModule
    ],
    templateUrl: './organizer-backgroud-map-menage.component.html'
})
export class OrganizerBackgroudMapMenageComponent {
    uploadForm: FormGroup;
    uploadProgress: number = 0;
    uploadMessage: string = '';

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
onUpload(event: any) {
    const file: File = event.files[0];

    if (!file) {
      this.uploadMessage = 'Wybierz plik!';
      return;
    }

    if (file.type !== 'image/tiff') {
      this.uploadMessage = 'Dozwolony jest tylko format GeoTIFF (image/tiff).';
      return;
    }

    // if (!this.uploadForm.valid) {
    //   this.uploadMessage = 'Wypełnij wszystkie pola!';
    //   return;
    // }

    // if (this.uploadForm.value.minZoom > this.uploadForm.value.maxZoom) {
    //   this.uploadMessage = 'Min Zoom nie może być większy niż Max Zoom!';
    //   return;
    // }

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
                this.uploadForm.reset();
            }
        },
        error: (err) => {
            this.uploadMessage = 'Wystąpił błąd podczas przesyłania pliku.';
            this.uploadProgress = 0;
        }
    });
  }
}