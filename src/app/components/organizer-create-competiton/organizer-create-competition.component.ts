import { Component } from "@angular/core";
import { BackofficeSendService } from "../../services/backoffice-send-service";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputText } from "primeng/inputtext";
import { Router } from '@angular/router';
import { CommonModule } from "@angular/common";
import { PasswordModule } from 'primeng/password';

@Component({
    selector: 'organizer-create-competiton',
    standalone: true,
    imports:[FormsModule, ReactiveFormsModule, InputText, CommonModule, PasswordModule],
    templateUrl: './organizer-create-competition.component.html'
})
export class OrganizerCreateCompetitonComponent {
    token: string | null = null
    createCompetitionForm: FormGroup;
    logInForm: FormGroup;
    isCreateCompetitonFormVisible: boolean = false;
    isLogInFormVisible: boolean = false;
    isUnautorizedVisible: boolean = false;

    constructor(private backofficeSendService: BackofficeSendService, private formBuilder: FormBuilder, private router: Router){
        this.createCompetitionForm = this.formBuilder.group({
            unit: [''],
            name: [''],
            year: [''],
            adminPassword: [''],
            organizerNickname: ['']
        })

        this.logInForm = this.formBuilder.group({
            unit: [''],
            name: [''],
            year: [''],
            adminPassword: [''],
            organizerNickname: ['']
        })
    }

    onSubmitCreateCompetitionForm() {
        let createCompetitionRequest = {
            signature: this.createCompetitionSignature(this.createCompetitionForm.value.unit, this.createCompetitionForm.value.name, this.createCompetitionForm.value.year),
            adminPassword: this.createCompetitionForm.value.adminPassword,
            organizerNickname: this.createCompetitionForm.value.organizerNickname
        }

        this.backofficeSendService.createCompetition(createCompetitionRequest)
        .subscribe({
            next: token => {
                this.token = token;
                localStorage.setItem('jwt', token);
                this.router.navigate(['/organizer/results']);
            },
            error: err => {
                console.error('Błąd', err)
            }
        })
    }

    onSubmitLogInForm() {
        let createCompetitionRequest = {
            signature: this.createCompetitionSignature(this.logInForm.value.unit, this.logInForm.value.name, this.logInForm.value.year),
            adminPassword: this.logInForm.value.adminPassword,
            organizerNickname: this.logInForm.value.organizerNickname
        }
        // dodo mock
    }

    showCreateCompetitonForm() {
        this.isCreateCompetitonFormVisible = true;
        this.isLogInFormVisible = false;
    }

    showLogInForm() {
        this.isLogInFormVisible = true;
        this.isCreateCompetitonFormVisible = false;
    }

    showUnauthorized() {
        this.isCreateCompetitonFormVisible = false;
        this.isLogInFormVisible = false;
        this.isUnautorizedVisible = true;
    }

    private createCompetitionSignature(unit: string, name: string, year: string): string {
        return `${unit}-${name}-${year}`
    }


}