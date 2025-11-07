import { AfterViewInit, Component, OnInit, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { DialogModule } from 'primeng/dialog';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoFocusModule } from 'primeng/autofocus';
import { TableModule, TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { Route } from '../../services/response/Route';
import { Station } from '../../services/response/Station';
import { SplitterModule } from 'primeng/splitter';
import { toDataURL } from 'qrcode';
import { TabsModule } from 'primeng/tabs';
import { Category } from '../../services/response/Category';
import { RouteOption } from '../../services/response/RouteOption';
import { DropdownModule } from 'primeng/dropdown';
import { Select } from 'primeng/select';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { BackgroundMapOption } from '../../services/response/BackgroundMapOption';
import { MapDownloaderService } from '../../services/map-downloader-dodo.service';


@Component({
  selector: 'organizer-category-view',
  standalone: true,
  imports: [CommonModule, TableModule, Select, BackofficeMapComponent, DropdownModule, ReactiveFormsModule, FormsModule, DialogModule, AutoFocusModule, ButtonModule, AutoFocusModule, SplitterModule, TabsModule],
  templateUrl: './organizer-category-view.component.html'
})
export class OrganizerCategoryViewComponent implements OnInit {
  @ViewChild(BackofficeMapComponent)
  mapComponent!: BackofficeMapComponent;

  routeOptions: RouteOption[] = []
  selectedRoute: Route | undefined;

  routes: Route[] = []

  categories: Category[] = [];
  selectedCategory!: Category;

  backgroundMapsOptions: BackgroundMapOption[] = [];
  isLoading: boolean = false;

  addCategoryForm: FormGroup
  showAddCategoryForm: boolean = false;

  editRouteForm: FormGroup;
  showEditRouteForm: boolean = false


  constructor(
    private formBuilder: FormBuilder,
    private backofficeSendService: BackofficeSendService,
    private mapDownloader: MapDownloaderService) {
      this.addCategoryForm = this.formBuilder.group({
        name: [''],
        routeId: [''],
        backgroundMapId: ['']
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

    this.backofficeSendService.getBackgroundMapOptions(request).subscribe ({
        next: (response) => {
          this.backgroundMapsOptions = response;
          // Pobierz wszystkie mapy tła po wejściu do widoku kategorii
          (async () => {
            this.isLoading = true;
            try {
              const downloads = (response || []).map(opt => {
                if (!opt?.id) {
                  console.warn('BackgroundMapOption bez id, pomijam', opt);
                  return Promise.resolve({ status: 'skipped' });
                }
                return this.mapDownloader.downloadMap(opt.id)
                  .then(() => ({ status: 'fulfilled', id: opt.id }))
                  .catch(err => ({ status: 'rejected', id: opt.id, reason: err }));
              });

              const results = await Promise.allSettled(downloads);
            } catch (err) {
              console.error('Błąd podczas pobierania map w widoku kategorii:', err);
            } finally {
              this.isLoading = false;
            }
          })();
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
      routeId: this.addCategoryForm.value.routeId,
      backgroundMapId: this.addCategoryForm.value.backgroundMapId
    }

    this.backofficeSendService.createCategory(request).subscribe({
      next: () => {
        this.addCategoryForm.reset()
        this.updateCategories()
      },
      error: (err) => console.log('dodo error createRoute', err)
    })

    this.showAddCategoryForm = false;
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
