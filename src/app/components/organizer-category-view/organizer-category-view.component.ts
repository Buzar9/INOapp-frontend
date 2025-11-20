import { Component, OnInit, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { DialogModule } from 'primeng/dialog';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoFocusModule } from 'primeng/autofocus';
import { TableModule } from 'primeng/table';
import { Route } from '../../services/response/Route';
import { Station } from '../../services/response/Station';
import { SplitterModule } from 'primeng/splitter';
import { TabsModule } from 'primeng/tabs';
import { Category } from '../../services/response/Category';
import { RouteOption } from '../../services/response/RouteOption';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'organizer-category-view',
  standalone: true,
  imports: [CommonModule, TableModule, BackofficeMapComponent, DropdownModule, ReactiveFormsModule, FormsModule, DialogModule, AutoFocusModule, ButtonModule, SplitterModule, TabsModule],
  templateUrl: './organizer-category-view.component.html',
  styleUrls: ['./organizer-category-view.component.css']
})
export class OrganizerCategoryViewComponent implements OnInit {
  @ViewChild(BackofficeMapComponent)
  mapComponent!: BackofficeMapComponent;

  routeOptions: RouteOption[] = []
  selectedRoute: Route | undefined;

  routes: Route[] = []

  categories: Category[] = [];
  selectedCategory!: Category;

  isLoading: boolean = false;

  addCategoryForm: FormGroup
  showAddCategoryForm: boolean = false;

  editRouteForm: FormGroup;
  showEditRouteForm: boolean = false


  constructor(
    private formBuilder: FormBuilder,
    private backofficeSendService: BackofficeSendService) {
      this.addCategoryForm = this.formBuilder.group({
        name: [''],
        routeId: ['']
      })

      this.editRouteForm = this.formBuilder.group({
        name: [''],
        route: [''],
      })
    }

  ngOnInit(): void {
    let request = {competitionId: 'Competition123'}
    this.backofficeSendService.getRouteOptions(request).subscribe ({
        next: (response) => {
          this.routeOptions = response
        },
        error: (err) => console.log('dodo problem dodo', err)
    })

    this.backofficeSendService.getRoutes(request).subscribe ({
        next: (response) => {
          this.routes = response
        },
        error: (err) => console.log('dodo problem dodo', err)
    })

    this.updateCategories()
  }

  onCreateCategoryClick() {
    this.showAddCategoryForm = true;
  }

  onSubmitAddCategoryForm() {
    let request = {
      name: this.addCategoryForm.value.name,
      competitionId: 'Competition123',
      routeId: this.addCategoryForm.value.routeId
    }

    this.backofficeSendService.createCategory(request).subscribe({
      next: () => {
        this.addCategoryForm.reset()
        this.showAddCategoryForm = false;
        this.updateCategories()
      },
      error: (err) => console.log('dodo error createRoute', err)
    })
  }

  onEditRouteClick() {
    this.showEditRouteForm = true
    this.editRouteForm.patchValue({
      name: this.selectedRoute?.name
    })
  }

  onDeleteCategoryClick(categoryId: string) {
    const request = {
      categoryId: categoryId,
    }
    this.backofficeSendService.deleteCategory(request).subscribe({
      next: () => {
        this.categories = this.categories.filter(category => category.id !== categoryId)
    },
      error: (err) => console.log('dodo error', err)
    })
  }

  getStationsForCategory(): Station[] {
    const routeId = this.selectedCategory?.routeId
    return this.routes.find(route => route.id === routeId)?.stations || []
  }

  getSelectedBackgroundMapId(): string | null {
    return this.selectedCategory?.backgroundMap?.id || null
  }

  getSelectedMinZoom(): number {
    return this.selectedCategory?.backgroundMap?.minZoom || 0
  }

  getSelectedMaxZoom(): number {
    return this.selectedCategory?.backgroundMap?.maxZoom || 0
  }

  getSelectedNorthEast(): [number, number] {
    return this.selectedCategory?.backgroundMap?.northEast || [0,0]
  }

  getSelectedSouthWest(): [number, number] {
    return this.selectedCategory?.backgroundMap?.southWest || [0,0]
  }

  private updateCategories() {
    this.backofficeSendService.getCategories().subscribe ({
        next: (response) => {
          this.categories = [...response]
        },
        error: (err) => console.log('dodo problem', err)
    })
  }
}
