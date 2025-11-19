import { Component, OnInit, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { BackofficeSendService } from '../../services/backoffice-send-service';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { DialogModule } from 'primeng/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { AutoFocusModule } from 'primeng/autofocus';
import { TableModule, TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { Route } from '../../services/response/Route';
import { Coordinates } from '../model/Coordinates';
import { Station } from '../../services/response/Station';
import { SplitterModule } from 'primeng/splitter';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';
import { DictionaryModel } from '../../services/response/DictionaryModel';
import { SelectModule } from 'primeng/select';
import { BackgroundMapOption } from '../../services/response/BackgroundMapOption';
import { MapDownloaderService } from '../../services/map-downloader-dodo.service';
import { QrCodeGeneratorService } from '../../services/qr-code-generator.service';


@Component({
  selector: 'organizer-route-view',
  standalone: true,
  imports: [CommonModule, TableModule, SelectModule, BackofficeMapComponent, ReactiveFormsModule, DialogModule, AutoFocusModule, ButtonModule, SplitterModule, TabsModule, ProgressSpinnerModule],
  templateUrl: './organizer-route-view.component.html',
  styleUrl: './organizer-route-view.component.css'
})
export class OrganizerRouteViewComponent implements OnInit {
  @ViewChild(BackofficeMapComponent)
  mapComponent!: BackofficeMapComponent;

  routes: Route[] = []
  selectedRoute?: Route
  addRouteForm: FormGroup
  showRouteNameForm: boolean = false;

  expandedRoutes: { [key: string]: boolean} = {}

  addStationForm: FormGroup
  showAddStationForm: boolean = false;

  selectedStation?: Station
  editStationForm: FormGroup;
  showEditStationForm: boolean = false;

  editRouteForm: FormGroup;
  showEditRouteForm: boolean = false

  stationTypeOptions?: DictionaryModel[]

  backgroundMapsOptions: BackgroundMapOption[] = [];
  isLoading: boolean = false;
  isMapFullscreen: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private backofficeSendService: BackofficeSendService,
    private mapDownloader: MapDownloaderService,
    private qrCodeGenerator: QrCodeGeneratorService
  ) {
      this.addRouteForm = this.formBuilder.group({
        name: [''],
        backgroundMapId: ['']
      })

      this.addStationForm = this.formBuilder.group({
        name: [''],
        type: [''],
        note: [''],
        lat: [''],
        lng:[''],
        accuracy: [10]
      })

      this.editStationForm = this.formBuilder.group({
        name: [''],
        type: [''],
        note: [''],
        lat: [''],
        lng:[''],
        accuracy: ['']
      })

      this.editRouteForm = this.formBuilder.group({
        name: ['']
      })
    }

  ngOnInit(): void {
    let request = {competitionId: 'Competition123'}
    this.backofficeSendService.getRoutes(request).subscribe ({
        next: async (response) => {
          this.routes = response
          await this.downloadMapsForExistingRoutes()
        },
        error: (err) => console.log('dodo problem', err)
    })

    this.backofficeSendService.getStationDictionary().subscribe ({
        next: (response) => {
          this.stationTypeOptions = response 
        },
        error: (err) => console.log('dodo problem dictionary', err)
    })

    this.backofficeSendService.getBackgroundMapOptions(request).subscribe ({
        next: (response) => {
          this.backgroundMapsOptions = response;
        },
        error: (err) => console.log('dodo problem dodo', err)
    })
  }

  async onSubmitAddRouteForm() {
    let request = {
      name: this.addRouteForm.value.name,
      backgroundMapId: this.addRouteForm.value.backgroundMapId,
      competitionId: 'Competition123'
    }

    this.isLoading = true;
    try {
      await this.mapDownloader.downloadMap(this.addRouteForm.value.backgroundMapId)

      this.backofficeSendService.createRoute(request).subscribe({
        next: (newRoute) => {
          // dodo po dodaniu route niech backend zwraca liste nowych routes i niech aktualizuje sie jak przy delete
          this.routes.push(newRoute)
          this.selectRoute(newRoute)
          this.isLoading = false;
        },
        error: (err) => {
          console.log('dodo error createRoute', err)
          this.isLoading = false;
        }
      })

      this.showRouteNameForm = !this.showRouteNameForm
    } catch (err) {
      console.error('Błąd podczas pobierania mapy:', err);
      this.isLoading = false;
    }
  }

  onAddStationClick() {
    this.addStationForm.reset({
      name: '',
      type: '',
      note: '',
      lat: '',
      lng: '',
      accuracy: 10
    });
    this.showAddStationForm = !this.showAddStationForm;
  }

  onCreateRouteClick() {
    this.showRouteNameForm = !this.showRouteNameForm;
  }

  onEditRouteClick() {
    this.showEditRouteForm = true
    this.editRouteForm.patchValue({
      name: this.selectedRoute?.name
    })
  }

  onEditRouteSubmit() {
    if (!this.selectedRoute) {
      console.warn('Nie wybrano trasy lub stanowiska.');
      return;
    }

    let request = {
      routeId: this.selectedRoute.id,
      name: this.editRouteForm.value.name
    }

    this.backofficeSendService.editRoute(request).subscribe({
      next: (response) => {
        const updatedRoutes = this.routes.map(route =>
          route.id === response.id ? response : route
        );
        this.routes = updatedRoutes
        const updatedRoute = this.routes.find( route => route.id === response.id)
        this.selectRoute(updatedRoute!)
      },
      error: (err) => console.log('dodo', err)
    })

    this.showEditRouteForm = false;
  }

  onDeleteRouteClick() {
    if (!this.selectedRoute) {
      console.warn('Nie wybrano trasy.');
      return;
    }

    const request = {
      routeId: this.selectedRoute.id,
    }
    this.backofficeSendService.deleteRoute(request).subscribe({
      next: (updatedRoutes) => {
        const listRequest = { competitionId: 'Competition123' };
        this.backofficeSendService.getRoutes(listRequest).subscribe({
          next: (freshRoutes) => {
            this.routes = freshRoutes || [];
            if (this.routes.length > 0) {
              this.expandedRoutes = { [`${this.routes[0].id}`]: true };
              this.selectRoute(this.routes[0]);
            } else {
              this.expandedRoutes = {};
              this.selectedRoute = undefined;
            }
          },
          error: (err) => {
            console.error('Błąd podczas odświeżania listy tras po usunięciu:', err);
            this.routes = [...updatedRoutes];
            if (updatedRoutes.length > 0) {
              this.expandedRoutes = { [`${updatedRoutes[0].id}`]: true };
              this.selectRoute(updatedRoutes[0]);
            } else {
              this.expandedRoutes = {};
              this.selectedRoute = undefined;
            }
          }
        });
    },
      error: (err) => console.log('dodo error', err)
    })
  }

  isRouteSelected(routeId: string): boolean {
    return this.selectedRoute?.id == routeId
  }

  onReceivedPointedCoordinates(coordinates: Coordinates) {
    this.addStationForm.patchValue({
      lat: coordinates.lat,
      lng: coordinates.lng
    });
  }

  onUseMapCenterForEdit() {
    const coordinates = this.mapComponent.getCurrentCenter();
    this.editStationForm.patchValue({
      lat: coordinates.lat,
      lng: coordinates.lng
    });
  }

  onUseMapCenterForAdd() {
    const coordinates = this.mapComponent.getCurrentCenter();
    this.addStationForm.patchValue({
      lat: coordinates.lat,
      lng: coordinates.lng
    });
  }

  toggleMapFullscreen() {
    this.isMapFullscreen = !this.isMapFullscreen;
    
    // Poczekaj na aktualizację DOM i invalidate size mapy
    setTimeout(() => {
      if (this.mapComponent) {
        this.mapComponent.invalidateSizeAndKeepCenter();
      }
    }, 100);
  }

  onSubmitAddStationForm() {
    if (!this.selectedRoute) {
      console.warn('Nie wybrano trasy – nie można dodać stacji.');
      return;
    }

    const formValue = this.addStationForm.value
    const request = {
      routeId: this.selectedRoute.id,
      name: formValue.name,
      type: formValue.type,
      location: { 
        lat: formValue.lat || 0.0, 
        lng: formValue.lng || 0.0, 
        accuracy: formValue.accuracy 
      },
      note: formValue.note
    }
    this.backofficeSendService.addStationToRoute(request).subscribe({
      next: (updatedRoute) => {
        this.routes = this.routes.map(route =>
        route.id === updatedRoute.id ? updatedRoute : route
        );
        this.selectRoute(updatedRoute);
      },
      error: (err) => console.log('dodo error', err)
    })
    this.showAddStationForm = false
    this.addStationForm.reset()
  }

  async onRouteExpand(event: TableRowExpandEvent) {
    this.selectRoute(event.data)
  }

  onRouteCollapse(event: TableRowCollapseEvent) {
    this.selectedRoute = undefined
  }

  onEditStation(stationId: string) {
    this.selectedStation = this.selectedRoute?.stations.find( station => station.properties["id"] === stationId)
    
    const stationType = this.selectedStation?.properties["type"];
    const matchingOption = this.stationTypeOptions?.find(opt => opt.label === stationType || opt.value === stationType);
    const typeValue = matchingOption ? matchingOption.value : stationType;
    
    this.editStationForm.patchValue({
      name: this.selectedStation?.properties["name"],
      type: typeValue,
      note: this.selectedStation?.properties["note"],
      accuracy: this.selectedStation?.properties["accuracy"],
      lat: this.selectedStation?.geometry.coordinates[1],
      lng: this.selectedStation?.geometry.coordinates[0],
    });
    this.showEditStationForm = true;
  }
// dodo primeng ConfirmDialog
  onDeleteStation(stationId: string) {
    if (!this.selectedRoute) {
      console.warn('Nie wybrano trasy.');
      return;
    }

    const request = {
      routeId: this.selectedRoute.id,
      stationId: stationId,
    }
    this.backofficeSendService.deleteStationToRoute(request).subscribe({
      next: (updatedRoute) => {
        this.routes = this.routes.map(route =>
        route.id === updatedRoute.id ? updatedRoute : route
        );
        this.selectRoute(updatedRoute);
      },
      error: (err) => console.log('dodo error', err)
    })
  }

  onToggleStationMount(stationId: string) {
    if (!this.selectedRoute) {
      console.warn('Nie wybrano trasy.');
      return;
    }

    const request = {
      routeId: this.selectedRoute.id,
      stationId: stationId,
    }
    this.backofficeSendService.toggleStationMount(request).subscribe({
      next: (updatedRoute) => {
        this.routes = [...this.routes.map(route =>
          route.id === updatedRoute.id ? updatedRoute : route
        )];
        this.selectedRoute = updatedRoute;
        this.expandedRoutes = { [`${updatedRoute.id}`]: true };
      },
      error: (err) => console.log('dodo error', err)
    })
  }

  onSubmitEditStationForm(){
    if (!this.selectedRoute || !this.selectedStation) {
      console.warn('Nie wybrano trasy lub stanowiska.');
      return;
    }

    const formValue = this.editStationForm.value
    const request = {
      routeId: this.selectedRoute.id,
      stationId: this.selectedStation.properties["id"],
      name: formValue.name,
      type: formValue.type,
      location: { lat: formValue.lat, lng: formValue.lng, accuracy: formValue.accuracy },
      note: formValue.note
    }
    this.backofficeSendService.editStationToRoute(request).subscribe({
      next: (updatedRoute) => {
        this.routes = this.routes.map(route =>
        route.id === updatedRoute.id ? updatedRoute : route
        );
        this.selectRoute(updatedRoute);
      },
      error: (err) => console.log('dodo error', err)
    })
    this.showEditStationForm = false
    this.editStationForm.reset()
  }

  onQrCodeRouteGenerateClick(stations: Station[]) {
    for (const station of stations) {
      this.onQrCodeStationGenerateClick(station)
    }
  }

  async onQrCodeStationGenerateClick(station: Station) {
    const routeName = this.selectedRoute?.name || '';
    const stationName = station.properties["name"] || '';
    
    await this.qrCodeGenerator.generateQrCodeWithText(
      station.properties["id"],
      routeName,
      stationName
    );
  }

  private selectRoute(route: Route) {
    this.expandedRoutes = {}
    this.expandedRoutes = { [`${route.id}`]: true}
    this.selectedRoute = route
  }

  getSelectedBackgroundMapId(): string | null {
    return this.selectedRoute?.backgroundMap?.id || null
  }

  getSelectedMinZoom(): number {
    // dodo troche kupa z tymi nullami
    return this.selectedRoute?.backgroundMap?.minZoom || 0
  }

  getSelectedMaxZoom(): number {
    return this.selectedRoute?.backgroundMap?.maxZoom || 0
  }

  getSelectedNorthEast(): [number, number] {
    return this.selectedRoute?.backgroundMap?.northEast || [0,0]
  }

  getSelectedSouthWest(): [number, number] {
    return this.selectedRoute?.backgroundMap?.southWest || [0,0]
  }

  private async downloadMapsForExistingRoutes(): Promise<void> {
    if (!this.routes || this.routes.length === 0) {
      return;
    }

    const uniqueMapIds = new Set<string>();
    this.routes.forEach(route => {
      if (route.backgroundMap?.id) {
        uniqueMapIds.add(route.backgroundMap.id);
      }
    });

    if (uniqueMapIds.size === 0) {
      console.log('Brak map do pobrania dla istniejących tras');
      return;
    }
    this.isLoading = true;

    try {
      const downloads = Array.from(uniqueMapIds).map(mapId =>
        this.mapDownloader.downloadMap(mapId)
          .then(() => ({ status: 'fulfilled', id: mapId }))
          .catch(err => ({ status: 'rejected', id: mapId, reason: err }))
      );
      await Promise.allSettled(downloads);
    } catch (err) {
      console.error('Błąd podczas pobierania map dla tras:', err);
    } finally {
      this.isLoading = false;
    }
  }
}
