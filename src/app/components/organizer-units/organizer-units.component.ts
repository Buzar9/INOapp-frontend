import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { Category } from '../../services/response/Category';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card'
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Unit } from '../../services/response/Unit';
import { MultiSelect } from 'primeng/multiselect';
import { QrCodeGeneratorService } from '../../services/qr-code-generator.service';
import { InputTextModule } from 'primeng/inputtext';


@Component({
  selector: 'organizer-units',
  standalone: true,
  imports: [CommonModule, CardModule, MultiSelect, FormsModule, TableModule, DropdownModule, DialogModule, ButtonModule, ReactiveFormsModule, InputTextModule],
  templateUrl: './organizer-units.component.html',
  styleUrl: './organizer-units.component.css'
})
export class OrganizerUnitsComponent implements OnInit {
    units: Unit[] = []
    categories: Category[] = []

    showInitializeCategoryDialog: boolean = false
    showEditUnitForm: boolean = false

    selectedUnit: Unit | null = null

    addUnitForm: FormGroup
    editUnitForm: FormGroup
    initializeCategoryForm: FormGroup
    showAddUnitForm: boolean = false

    constructor(
        private formBuilder: FormBuilder,
        private backofficeSendService: BackofficeSendService,
        private qrCodeGenerator: QrCodeGeneratorService
    ) {
        this.addUnitForm = this.formBuilder.group({
            name: ['']
        })

        this.editUnitForm = this.formBuilder.group({
            name: ['']
        })

        this.initializeCategoryForm = this.formBuilder.group({
            categories: [[]]
        })
    }

    ngOnInit(): void {
        this.backofficeSendService.getUnits().subscribe({
            next: (units) => this.units = units,
            error: (err) => console.log('dodo zonk', err)
        })

        this.backofficeSendService.getCategories().subscribe({
            next: (categories) => this.categories = categories,
            error: (err) => console.log('dodo zonk', err)
        })
    }

    onAddUnitClick() {
        this.showAddUnitForm = true
    }

    onAddUnitFormSubmit() {
        let request = {name: this.addUnitForm.value.name}
        this.backofficeSendService.createUnit(request).subscribe({
            error: (err) => console.log('dodo zonk', err)
        })
        this.addUnitForm.reset()
        this.showAddUnitForm = false
    }

    onEditUnitClick(unit: Unit) {
        console.log(unit)
        this.selectedUnit = unit
        this.showEditUnitForm = true
    }

    onEditUnitFormSubmit() {
        if(!this.selectedUnit) return

        let request = {id: this.selectedUnit.id, name: this.editUnitForm.value.name}
        console.log(this.selectedUnit)
        this.backofficeSendService.editUnit(request).subscribe({
            next: () => console.log('dodo git'),
            error: (err) => console.log('dodo zonk', err)
        })

        this.editUnitForm.reset()
        this.showEditUnitForm = false
    }

    onDeleteUnitClick(unitId: string) {
        let request = {id: unitId}
        this.backofficeSendService.deleteUnit(request).subscribe({
            next: () => console.log('dodo git'),
            error: (err) => console.log('dodo zonk', err)
        })
    }

    onInitializeCategoryClick(unit: Unit) {
        this.selectedUnit = unit
        this.initializeCategoryForm.patchValue({
            categories: []
        })
        this.showInitializeCategoryDialog = true
    }

    onInitializeCategorySubmit() {
        if (!this.selectedUnit) {
            console.warn('Nie wybrano jednostki');
            return;
        }

        const selectedCategories: Category[] = this.initializeCategoryForm.value.categories
        
        for (let category of selectedCategories) {
            const data = JSON.stringify({
                competitionId: "Competition123", 
                categoryId: category.id, 
                participantUnitName: this.selectedUnit.name
            })

            this.downloadQrCode(category, data)
        }

        this.initializeCategoryForm.reset()
        this.selectedUnit = null
        this.showInitializeCategoryDialog = false
    }

    private async downloadQrCode(category: Category, data: string) {
        await this.qrCodeGenerator.generateQrCodeWithText(
            data,
            `INIT - ${this.selectedUnit?.name || ''}`,
            category.name
        );
    }
}
