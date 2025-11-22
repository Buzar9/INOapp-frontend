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
import { Station, ConsolidatedStationView } from '../../services/response/Station';
import { ConsolidatedRouteView } from '../../services/response/ConsolidatedRouteView';
import { SplitterModule } from 'primeng/splitter';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';
import { DictionaryModel } from '../../services/response/DictionaryModel';
import { SelectModule } from 'primeng/select';
import { BackgroundMapOption } from '../../services/response/BackgroundMapOption';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { MapDownloaderService } from '../../services/map-downloader-dodo.service';
import { QrCodeGeneratorService } from '../../services/qr-code-generator.service';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TileDbService } from '../../services/tile-db.service';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'organizer-route-view',
  standalone: true,
  imports: [CommonModule, TableModule, SelectModule, BackofficeMapComponent, ReactiveFormsModule, FormsModule, DialogModule, AutoFocusModule, ButtonModule, SplitterModule, TabsModule, ProgressSpinnerModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  templateUrl: './organizer-route-view.component.html',
  styleUrl: './organizer-route-view.component.css'
})
export class OrganizerRouteViewComponent implements OnInit {
  @ViewChild(BackofficeMapComponent)
  mapComponent!: BackofficeMapComponent;

  routes: Route[] = []
  selectedRoute?: Route
  consolidatedRouteView?: ConsolidatedRouteView
  isConsolidatedView: boolean = false
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
  backgroundMaps: BackgroundMap[] = [];
  selectedConsolidatedBackgroundMapId: string | undefined;
  isLoading: boolean = false;
  isMapFullscreen: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private backofficeSendService: BackofficeSendService,
    private mapDownloader: MapDownloaderService,
    private qrCodeGenerator: QrCodeGeneratorService,
    private confirmationService: ConfirmationService,
    private tileDb: TileDbService
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
        next: (response) => {
          this.routes = response
        },
        error: (err) => console.log(err)
    })

    this.backofficeSendService.getStationDictionary().subscribe ({
        next: (response) => {
          this.stationTypeOptions = response
        },
        error: (err) => console.log(err)
    })

    this.backofficeSendService.getBackgroundMapOptions(request).subscribe ({
        next: (response) => {
          this.backgroundMapsOptions = response;
        },
        error: (err) => console.log(err)
    })

    this.backofficeSendService.getBackgroundMaps(request).subscribe ({
        next: (response) => {
          this.backgroundMaps = response;
        },
        error: (err) => console.log(err)
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
      const selectedBgMap = this.backgroundMapsOptions.find(opt => opt.id === this.addRouteForm.value.backgroundMapId);

      if (selectedBgMap) {
        await this.mapDownloader.downloadMap(selectedBgMap.id, {
          name: selectedBgMap.name
        });
      }

      this.backofficeSendService.createRoute(request).subscribe({
        next: async (newRoute) => {
          this.routes.push(newRoute)
          this.selectRoute(newRoute)

          await this.trackMapUsageForRoute(newRoute.id, newRoute.backgroundMap?.id);

          this.isLoading = false;
        },
        error: (err) => {
          console.log(err)
          this.isLoading = false;
        }
      })

      this.showRouteNameForm = !this.showRouteNameForm
    } catch (err) {
      console.error(err);
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
      error: (err) => console.log(err)
    })

    this.showEditRouteForm = false;
  }

  onDeleteRouteClick() {
    if (!this.selectedRoute) {
      return;
    }

    const routeToDelete = this.selectedRoute;

    this.confirmationService.confirm({
      message: `Czy na pewno chcesz usunąć trasę "${this.selectedRoute.name}"?`,
      header: 'Potwierdzenie usunięcia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Tak',
      rejectLabel: 'Nie',
      accept: async () => {
        const request = {
          routeId: routeToDelete.id,
        }

        await this.untrackMapUsageForRoute(routeToDelete.id, routeToDelete.backgroundMap?.id);

        this.backofficeSendService.deleteRoute(request).subscribe({
          next: (updatedRoutes) => {
            const listRequest = { competitionId: 'Competition123' };
            this.backofficeSendService.getRoutes(listRequest).subscribe({
              next: (freshRoutes) => {
                this.routes = freshRoutes || [];
                this.expandedRoutes = {};
                this.selectedRoute = undefined;
              },
              error: (err) => {
                console.error(err);
                this.routes = [...updatedRoutes];
                this.expandedRoutes = {};
                this.selectedRoute = undefined;
              }
            });
          },
          error: (err) => console.log(err)
        })
      }
    });
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

    setTimeout(() => {
      if (this.mapComponent) {
        this.mapComponent.invalidateSizeAndKeepCenter();
      }
    }, 100);
  }

  onSubmitAddStationForm() {
    if (!this.selectedRoute) {
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

        setTimeout(() => {
          if (this.mapComponent && updatedRoute.stations) {
            this.mapComponent.setStations(updatedRoute.stations);
          }
        }, 100);
      },
      error: (err) => console.log(err)
    })
    this.showAddStationForm = false
    this.addStationForm.reset()
  }

  async onRouteExpand(event: TableRowExpandEvent) {
    const route = event.data;
    // Pobierz mapę dla tej trasy jeśli jest przypisana
    if (route.backgroundMap?.id) {
      this.isLoading = true;
      try {
        await this.mapDownloader.downloadMap(route.backgroundMap.id, {
          name: route.backgroundMap.name,
          minZoom: route.backgroundMap.minZoom,
          maxZoom: route.backgroundMap.maxZoom,
          bounds: {
            north: route.backgroundMap.northEast?.[0],
            east: route.backgroundMap.northEast?.[1],
            south: route.backgroundMap.southWest?.[0],
            west: route.backgroundMap.southWest?.[1]
          }
        });

        // Oznacz mapę jako używaną przez tę trasę
        await this.trackMapUsageForRoute(route.id, route.backgroundMap.id);

      } catch (err) {
        console.error('[onRouteExpand] Error downloading map:', err);
      } finally {
        this.isLoading = false;
      }
    }

    this.selectRoute(route);

    // Daj czas na zainicjalizowanie mapy w DOM, a następnie wymuś odświeżenie stanowisk
    setTimeout(() => {
      if (this.mapComponent && route.stations) {
        this.mapComponent.setStations(route.stations);
      }
    }, 200);
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
  onDeleteStation(stationId: string) {
    if (!this.selectedRoute) {
      return;
    }

    const station = this.selectedRoute.stations.find(s => s.properties['id'] === stationId);
    const stationName = station?.properties['name'] || 'to stanowisko';

    this.confirmationService.confirm({
      message: `Czy na pewno chcesz usunąć stanowisko "${stationName}"?`,
      header: 'Potwierdzenie usunięcia',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Tak',
      rejectLabel: 'Nie',
      accept: () => {
        const request = {
          routeId: this.selectedRoute!.id,
          stationId: stationId,
        }
        this.backofficeSendService.deleteStationToRoute(request).subscribe({
          next: (updatedRoute) => {
            this.routes = this.routes.map(route =>
            route.id === updatedRoute.id ? updatedRoute : route
            );
            this.selectRoute(updatedRoute);

            // Wymuś odświeżenie stanowisk na mapie
            setTimeout(() => {
              if (this.mapComponent && updatedRoute.stations) {
                this.mapComponent.setStations(updatedRoute.stations);
              }
            }, 100);
          },
          error: (err) => console.log(err)
        })
      }
    });
  }

  onToggleStationMount(stationId: string) {
    if (!this.selectedRoute) {
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

        // Wymuś odświeżenie stanowisk na mapie
        setTimeout(() => {
          if (this.mapComponent && updatedRoute.stations) {
            this.mapComponent.setStations(updatedRoute.stations);
          }
        }, 100);
      },
      error: (err) => console.log(err)
    })
  }

  onSubmitEditStationForm(){
    if (!this.selectedRoute || !this.selectedStation) {
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

        // Wymuś odświeżenie stanowisk na mapie
        setTimeout(() => {
          if (this.mapComponent && updatedRoute.stations) {
            this.mapComponent.setStations(updatedRoute.stations);
          }
        }, 100);
      },
      error: (err) => console.log(err)
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
// dodo pwa ktora trzyma sesje
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


  /**
   * Oznacza mapę jako używaną przez określoną trasę.
   */
  private async trackMapUsageForRoute(routeId: string, mapId: string | undefined): Promise<void> {
    if (!mapId) {
      return;
    }

    try {
      const metadata = await this.tileDb.getMapMetadata(mapId);
      if (metadata) {
        const currentUsedInRoutes = metadata.usedInRoutes || [];

        // Dodaj trasę jeśli jeszcze nie jest na liście
        if (!currentUsedInRoutes.includes(routeId)) {
          await this.tileDb.updateMapMetadata(mapId, {
            usedInRoutes: [...currentUsedInRoutes, routeId]
          });
        }
      }
    } catch (err) {
      console.error('Error tracking map usage:', err);
    }
  }

  /**
   * Usuwa trasę z listy użycia w metadanych mapy.
   */
  private async untrackMapUsageForRoute(routeId: string, mapId: string | undefined): Promise<void> {
    if (!mapId) {
      return;
    }

    try {
      const metadata = await this.tileDb.getMapMetadata(mapId);
      if (metadata && metadata.usedInRoutes) {
        const updatedRoutes = metadata.usedInRoutes.filter(id => id !== routeId);
        await this.tileDb.updateMapMetadata(mapId, {
          usedInRoutes: updatedRoutes
        });
      }
    } catch (err) {
      console.error('Error untracking map usage:', err);
    }
  }

  onViewAllStationsClick() {
    this.isConsolidatedView = true;
    this.selectedRoute = undefined;
    this.expandedRoutes = {};

    this.isLoading = true;
    const request = { competitionId: 'Competition123' };

    this.backofficeSendService.getConsolidatedRouteView(request).subscribe({
      next: (consolidatedRouteView) => {
        this.consolidatedRouteView = consolidatedRouteView;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading consolidated route view:', err);
        this.isLoading = false;
      }
    });
  }

  onToggleConsolidatedStationMount(stationId: string) {
    if (!this.isConsolidatedView || !this.consolidatedRouteView) {
      return;
    }

    const station = this.consolidatedRouteView.consolidatedStations.find(s => s.id === stationId);
    if (!station) {
      return;
    }

    const request = {
      routeId: station.routeId,
      stationId: stationId,
    };

    this.backofficeSendService.toggleStationMount(request).subscribe({
      next: () => {
        // Zaktualizuj stan stacji w widoku consolidated
        station.isMounted = !station.isMounted;

        setTimeout(() => {
          if (this.mapComponent && this.consolidatedRouteView) {
            this.mapComponent.setStations(this.convertConsolidatedStationsToGeoView(this.consolidatedRouteView.consolidatedStations));
          }
        }, 100);
      },
      error: (err) => console.error('Error toggling consolidated station mount:', err)
    });
  }

  onBackToRoutesClick() {
    this.isConsolidatedView = false;
    this.consolidatedRouteView = undefined;
    this.selectedRoute = undefined;
    this.expandedRoutes = {};
    this.selectedConsolidatedBackgroundMapId = undefined;
  }

  convertConsolidatedStationsToGeoView(stations: ConsolidatedStationView[]): Station[] {
    return stations.map(station => ({
      type: 'Feature',
      geometry: station.geometry,
      properties: {
        id: station.id,
        name: station.name,
        type: station.type,
        note: station.note,
        accuracy: station.accuracy.toString(),
        isMounted: station.isMounted.toString(),
        routeId: station.routeId,
        routeName: station.routeName
      }
    }));
  }

  getConsolidatedStationsAsGeoView(): Station[] {
    if (!this.consolidatedRouteView) {
      return [];
    }
    return this.convertConsolidatedStationsToGeoView(this.consolidatedRouteView.consolidatedStations);
  }

  async onConsolidatedMapChange(event: any) {
    const selectedMapId = event.value;
    this.selectedConsolidatedBackgroundMapId = selectedMapId;

    const selectedMap = this.backgroundMaps.find(map => map.id === selectedMapId);

    if (selectedMap && this.consolidatedRouteView) {
      this.isLoading = true;
      try {
        await this.mapDownloader.downloadMap(selectedMap.id, {
          name: selectedMap.name,
          minZoom: selectedMap.minZoom,
          maxZoom: selectedMap.maxZoom,
          bounds: {
            north: selectedMap.northEast?.[0],
            east: selectedMap.northEast?.[1],
            south: selectedMap.southWest?.[0],
            west: selectedMap.southWest?.[1]
          }
        });

        setTimeout(() => {
          if (this.mapComponent && this.consolidatedRouteView) {
            this.mapComponent.setStations(this.convertConsolidatedStationsToGeoView(this.consolidatedRouteView.consolidatedStations));
          }
        }, 300);
      } catch (err) {
        console.error('Error loading selected map:', err);
      } finally {
        this.isLoading = false;
      }
    }
  }

  getConsolidatedBackgroundMapId(): string | null {
    return this.selectedConsolidatedBackgroundMapId || null;
  }

  getConsolidatedMinZoom(): number {
    const selectedMap = this.backgroundMaps.find(m => m.id === this.selectedConsolidatedBackgroundMapId);
    return selectedMap?.minZoom || 0;
  }

  getConsolidatedMaxZoom(): number {
    const selectedMap = this.backgroundMaps.find(m => m.id === this.selectedConsolidatedBackgroundMapId);
    return selectedMap?.maxZoom || 0;
  }

  getConsolidatedNorthEast(): [number, number] {
    const selectedMap = this.backgroundMaps.find(m => m.id === this.selectedConsolidatedBackgroundMapId);
    return selectedMap?.northEast || [0, 0];
  }

  getConsolidatedSouthWest(): [number, number] {
    const selectedMap = this.backgroundMaps.find(m => m.id === this.selectedConsolidatedBackgroundMapId);
    return selectedMap?.southWest || [0, 0];
  }
}
