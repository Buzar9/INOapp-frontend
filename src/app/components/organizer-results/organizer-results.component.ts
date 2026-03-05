import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RaceResult } from '../../services/response/RaceResults';
import { TableModule, TableRowCollapseEvent, TableRowExpandEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { BackofficeSendService } from '../../services/backoffice-send-service';

import { TagModule } from 'primeng/tag';
import { ControlPoint } from '../../services/response/RaceResults';
import { BackofficeMapComponent } from '../map/backoffice-map.component';
import { SplitterModule } from 'primeng/splitter';
import { Route } from '../../services/response/Route';
import { Station } from '../../services/response/Station';
import { MultiSelect, MultiSelectModule } from 'primeng/multiselect';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DictionaryModel } from '../../services/response/DictionaryModel';
import { Category } from '../../services/response/Category';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BackgroundMapOption } from '../../services/response/BackgroundMapOption';
import { Select } from 'primeng/select';
import { BackgroundMap } from '../../services/response/BackgroundMap';
import { DialogModule } from 'primeng/dialog';
import { AddControlPointRequest, CancelRunRequest } from '../../services/backoffice-requests';
import { DatePicker } from 'primeng/datepicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MapDownloaderService } from '../../services/map-downloader-dodo.service';
import { OrganizerDataCacheService } from '../../services/organizer-data-cache.service';

@Component({
  selector: 'app-organizer-results',
  standalone: true,
  imports: [CommonModule, ScrollPanelModule, Select, TableModule, BackofficeMapComponent, TagModule, ButtonModule, SplitterModule, MultiSelectModule, FormsModule, ReactiveFormsModule, ProgressSpinnerModule, DialogModule, DatePicker, ConfirmDialogModule, ToastModule],
  providers: [ConfirmationService, MessageService],
  templateUrl: './organizer-results.component.html',
  styles: [`
    .results-container {
      height: calc(100vh - 60px);
      overflow: hidden;
    }
    .results-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
    }
    .filters-section {
      flex-shrink: 0;
    }
    .map-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .table-section {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .canceled-row {
      opacity: 0.5;
    }
    :host ::ng-deep .highlighted-row {
      background-color: var(--primary-100, rgba(var(--primary-color-rgb), 0.15)) !important;
    }
  `]
})
export class OrganizerResultsComponent implements OnInit {
  @ViewChild(BackofficeMapComponent) mapComponent!: BackofficeMapComponent;
  accuracyVisible = true;
  trackVisible = false;
  highlightedRunId: string | null = null;
  allRaceResults: RaceResult[] = [];
  raceResults: RaceResult[] = [];
  routes: Route[] = []
  expandedRows: { [key: string]: boolean } = {};
  selectedControlPoints: (ControlPoint & { participantNickname: string, participantUnit: string, categoryName: string })[] = [];
  isLoading = false;
  selectedRouteStations: Station[] = []

  filterForm: FormGroup
  teamOptions: string[] = []
  categories: Category[] = []
  categoryOptions: string[] = []
  selectedStationCategories: string[] = []
  statusOptions: DictionaryModel[] = []

  backgroundMapsOptions: BackgroundMapOption[] = [];
  backgroundMaps: BackgroundMap[] = [];
  selectedBackgroundMapId: string | undefined;
  selectedBackgroundMap: BackgroundMap | undefined;

  showAddControlPointDialog = false;
  selectedResult: RaceResult | null = null;
  availableStations: Station[] = [];
  selectedStationId: string | null = null;
  selectedTime: Date = new Date();
  showTimePicker = false;
  reporter: string = '';

  isMapLoading = false;

  constructor(
    private backofficeSendService: BackofficeSendService,
    private formBuilder: FormBuilder,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private mapDownloader: MapDownloaderService,
    private cache: OrganizerDataCacheService,
  ) {
    this.filterForm =  this.formBuilder.group({
        teamSelectedOptions: [''],
        categorySelectedOptions: [''],
        statusSelectedOptions: ['']
    });
  }

// dodo paginacja
// wyswietlanie po kategorii i trasie
//  tłumaczenie wszystkich enumum, zeby nie wyciekalo

  ngOnInit(): void {
    let initRequest = {
      filter: undefined,
      pageNumber: 0
    }

    if (this.cache.raceResults !== null) {
      this.allRaceResults = this.cache.raceResults;
      this.raceResults = this.allRaceResults;
    } else {
      this.isLoading = true;
      this.backofficeSendService.getRaceResults(initRequest).subscribe({
        next: (data) => {
          this.allRaceResults = data;
          this.raceResults = data;
          this.cache.raceResults = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('dodo error get', err);
          this.isLoading = false;
        }
      })
    }

    let request = {competitionId: 'Competition123'}

    if (this.cache.routes !== null) {
      this.routes = this.cache.routes;
    } else {
      this.backofficeSendService.getRoutes(request).subscribe({
        next: (routes) => {
          this.routes = routes;
          this.cache.routes = routes;
        },
        error: (err) => console.error('dodo err', err)
      })
    }

    if (this.cache.categories !== null) {
      this.categories = this.cache.categories;
      this.categoryOptions = this.cache.categoryOptions!;
    } else {
      this.backofficeSendService.getCategories().subscribe({
        next: (categories) => {
          this.categories = categories;
          this.categoryOptions = categories.map(category => category.name);
          this.cache.categories = categories;
          this.cache.categoryOptions = this.categoryOptions;
        },
        error: (err) => console.error('dodo err', err)
      })
    }

    if (this.cache.units !== null) {
      this.teamOptions = this.cache.units;
    } else {
      this.backofficeSendService.getUnits().subscribe({
        next: (units) => {
          this.teamOptions = units.map(unit => unit.name);
          this.cache.units = this.teamOptions;
        },
        error: (err) => console.error('dodo err', err)
      })
    }

    if (this.cache.statusDictionary !== null) {
      this.statusOptions = this.cache.statusDictionary;
    } else {
      this.backofficeSendService.getStatusDictionary().subscribe({
        next: (response) => {
          this.statusOptions = response;
          this.cache.statusDictionary = response;
        },
        error: (err) => console.error('dodo err', err)
      })
    }

    if (this.cache.backgroundMapOptions !== null) {
      this.backgroundMapsOptions = this.cache.backgroundMapOptions;
    } else {
      this.backofficeSendService.getBackgroundMapOptions(request).subscribe ({
        next: (response) => {
          this.backgroundMapsOptions = response;
          this.cache.backgroundMapOptions = response;
        },
        error: (err) => console.log('dodo problem dodo', err)
      })
    }

    if (this.cache.backgroundMaps !== null) {
      this.backgroundMaps = this.cache.backgroundMaps;
    } else {
      this.backofficeSendService.getBackgroundMaps(request).subscribe ({
        next: (response) => {
          this.backgroundMaps = response;
          this.cache.backgroundMaps = response;
        },
        error: (err) => console.log('dodo  dodo', err)
      })
    }
  }

  isRunFinished(status: string): boolean {
    return status === 'FINISHED'
  }

  getControlPointsNumber(result: RaceResult): string {
    const controlPoints = result.controlPoints
    const checkpoints = controlPoints.filter((controlPoint) => controlPoint.type === "CHECKPOINT")

    return checkpoints.length.toString()
  }

  getSeverity(result: string): string {
      switch (result) {
        case 'PASSED':
          return 'success'
        case 'FAILED':
          return 'danger'
        case 'INSUFFICIENT_DATA':
          return 'info'
        default:
          return 'warn'
      }
    }

  getStatusIcon(status:string): string {
    switch (status) {
      case 'PASSED':
        return 'pi pi-check';
      case 'FAILED':
        return 'pi pi-times'
      case 'INSUFFICIENT_DATA':
        return 'pi pi-question'
      default:
        return 'pi pi-ban'
    }
  }

    allExpanded = false;

    toggleAll() {
      if (this.allExpanded) {
        this.expandedRows = {};
        this.selectedControlPoints = [];
        this.mapComponent.clearAllGpsTracks();
      } else {
        this.expandedRows = {};
        this.selectedControlPoints = [];
        for (const result of this.raceResults) {
          this.expandedRows[result.runId] = true;
          const cps = result.controlPoints.map(cp => ({ ...cp, participantNickname: result.participantNickname, participantUnit: result.participantUnit, categoryName: result.categoryName }));
          this.selectedControlPoints = [...this.selectedControlPoints, ...cps];
        }
        if (this.trackVisible) {
          this.fetchAndDisplayTracksForExpanded();
        }
      }
      this.allExpanded = !this.allExpanded;
    }

    onRowExpand(event: TableRowExpandEvent) {
      const cps = event.data.controlPoints.map((cp: ControlPoint) => ({ ...cp, participantNickname: event.data.participantNickname, participantUnit: event.data.participantUnit, categoryName: event.data.categoryName }));
      this.selectedControlPoints = [...this.selectedControlPoints, ...cps];
      if (this.trackVisible && event.data.runTrackId) {
        const cached = this.cache.gpsTracks.get(event.data.runTrackId);
        if (cached) {
          this.displayTrackFromCache(event.data.runId);
        } else {
          this.backofficeSendService.getGpsTrackBatch([event.data.runTrackId]).subscribe({
            next: (tracks) => {
              const track = tracks.find(t => t.runId === event.data.runTrackId);
              if (track) {
                this.cache.gpsTracks.set(event.data.runTrackId, track);
                if (track.segments && track.segments.length > 0) {
                  this.mapComponent.displayGpsTrack(event.data.runId, track.segments, event.data.participantNickname);
                }
              }
            }
          });
        }
      }
    }

    onRowCollapse(event: TableRowCollapseEvent) {
      const collapsedNames = new Set(event.data.controlPoints.map((cp: ControlPoint) => cp.name));
      const nickname = event.data.participantNickname;
      this.selectedControlPoints = this.selectedControlPoints.filter(
        cp => !(collapsedNames.has(cp.name) && cp.participantNickname === nickname)
      );
      if (this.trackVisible) {
        this.mapComponent.clearGpsTrack(event.data.runId);
      }
    }

    onCategoryChange(selectedCategoryNames: string[]) {
      const routeIds = this.categories
        .filter(cat => selectedCategoryNames.includes(cat.name))
        .map(cat => cat.routeId);

      this.selectedRouteStations = this.routes
        .filter(route => routeIds.includes(route.id))
        .flatMap(route => route.stations);
    }

    onFilterFormSubmit() {
      const formValues = this.filterForm.value;

      const teamFilters: string[] = formValues.teamSelectedOptions ? formValues.teamSelectedOptions : [];
      const categoryFilters: string[] = formValues.categorySelectedOptions ? formValues.categorySelectedOptions : [];
      const statusFilters: string[] = formValues.statusSelectedOptions ? formValues.statusSelectedOptions : [];

      this.raceResults = this.allRaceResults.filter(result => {
        if (teamFilters.length > 0 && !teamFilters.includes(result.participantUnit)) return false;
        if (categoryFilters.length > 0 && !categoryFilters.includes(result.categoryName)) return false;
        if (statusFilters.length > 0 && !statusFilters.includes(result.status)) return false;
        return true;
      });
    }

    async changeMap(event: any) {
      this.selectedBackgroundMapId = event.value;
      const map = this.backgroundMaps.find(m => m.id === this.selectedBackgroundMapId);

      if (map) {
        this.isMapLoading = true;
        try {
          await this.mapDownloader.downloadMap(map.id, {
            name: map.name,
            minZoom: map.minZoom,
            maxZoom: map.maxZoom,
            bounds: {
              north: map.northEast?.[0],
              east: map.northEast?.[1],
              south: map.southWest?.[0],
              west: map.southWest?.[1]
            }
          });
          this.selectedBackgroundMap = map;
        } catch (err) {
          console.error('[OrganizerResults] Error downloading map:', err);
        } finally {
          this.isMapLoading = false;
        }
      }
    }

    openAddControlPointDialog(result: RaceResult) {
      this.selectedResult = result;
      this.selectedStationId = null;
      this.selectedTime = new Date();
      this.showTimePicker = false;

      const category = this.categories.find(cat => cat.name === result.categoryName);
      const existingStationIds = new Set(result.controlPoints.map(cp => cp.stationId));

      if (category) {
        const route = this.routes.find(r => r.id === category.routeId);
        const allStations = route ? route.stations : [];
        this.availableStations = allStations.filter(s => !existingStationIds.has(s.properties['id']));
      } else {
        this.availableStations = [];
      }

      this.showAddControlPointDialog = true;
    }

    onStationSelect() {
      const station = this.availableStations.find(s => s.properties['id'] === this.selectedStationId);
      const type = station?.properties['type']?.toUpperCase();
      this.showTimePicker = type === 'START' || type === 'FINISH';
    }

    hasAvailableStations(result: RaceResult): boolean {
      const category = this.categories.find(cat => cat.name === result.categoryName);
      if (!category) return false;
      const route = this.routes.find(r => r.id === category.routeId);
      if (!route) return false;
      const existingStationIds = new Set(result.controlPoints.map(cp => cp.stationId));
      return route.stations.some(s => !existingStationIds.has(s.properties['id']));
    }

    submitAddControlPoint() {
      if (!this.selectedResult || !this.selectedStationId) return;

      const request: AddControlPointRequest = {
        runId: this.selectedResult.runId,
        stationId: this.selectedStationId,
        ...(this.showTimePicker ? { timestamp: this.selectedTime.toISOString() } : {}),
        ...(this.reporter.trim() ? { reporter: this.reporter.trim() } : {})
      };

      this.showAddControlPointDialog = false;

      this.expandedRows[this.selectedResult.runId] = true;
      const cps = this.selectedResult.controlPoints.map(cp => ({ ...cp, participantNickname: this.selectedResult!.participantNickname, participantUnit: this.selectedResult!.participantUnit, categoryName: this.selectedResult!.categoryName }));
      const existingNames = new Set(this.selectedControlPoints.filter(cp => cp.participantNickname === this.selectedResult!.participantNickname).map(cp => cp.name));
      const newCps = cps.filter(cp => !existingNames.has(cp.name));
      this.selectedControlPoints = [...this.selectedControlPoints, ...newCps];

      this.isLoading = true;
      this.backofficeSendService.addControlPoint(request).subscribe({
        next: () => {
          this.refreshResults();
        },
        error: (err) => {
          console.error('Error adding control point', err);
          this.isLoading = false;
        }
      });
    }

    isRunCanceled(status: string): boolean {
      return status === 'CANCELED';
    }

    onCancelRunClick(result: RaceResult) {
      this.confirmationService.confirm({
        message: `Czy na pewno chcesz anulować bieg uczestnika "${result.participantNickname}"? Ta akcja jest nieodwracalna.`,
        header: 'Anulowanie biegu',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Tak, anuluj',
        rejectLabel: 'Nie',
        acceptButtonStyleClass: 'p-button-danger',
        accept: () => {
          const request: CancelRunRequest = {
            runId: result.runId,
            reporter: ''
          };
          this.isLoading = true;
          this.backofficeSendService.cancelRun(request).subscribe({
            next: () => {
              this.refreshResults();
            },
            error: (err) => {
              console.error('Error canceling run', err);
              this.isLoading = false;
            }
          });
        }
      });
    }

    toggleTrack() {
      if (this.trackVisible) {
        this.mapComponent.setTrackVisibility(false);
        this.trackVisible = false;
      } else {
        this.fetchAndDisplayTracksForExpanded();
        this.mapComponent.setTrackVisibility(true);
        this.trackVisible = true;
      }
    }

    toggleHighlightTrack(result: RaceResult) {
      if (this.highlightedRunId === result.runId) {
        this.mapComponent.unhighlightTrack(result.runId);
        this.highlightedRunId = null;
      } else {
        if (this.highlightedRunId) {
          this.mapComponent.unhighlightTrack(this.highlightedRunId);
        }
        if (!this.trackVisible) {
          this.mapComponent.setTrackVisibility(true);
          this.trackVisible = true;
        }
        this.ensureTrackDisplayed(result, () => {
          this.mapComponent.highlightTrack(result.runId);
          this.highlightedRunId = result.runId;
        });
      }
    }

    private ensureTrackDisplayed(result: RaceResult, callback: () => void) {
      if (!result.runTrackId) return;
      if (this.mapComponent.hasTrack(result.runId)) {
        callback();
        return;
      }
      const cached = this.cache.gpsTracks.get(result.runTrackId);
      if (cached && cached.segments && cached.segments.length > 0) {
        this.mapComponent.displayGpsTrack(result.runId, cached.segments, result.participantNickname);
        callback();
        return;
      }
      this.backofficeSendService.getGpsTrackBatch([result.runTrackId]).subscribe({
        next: (tracks) => {
          const track = tracks.find(t => t.runId === result.runTrackId);
          if (track) {
            this.cache.gpsTracks.set(result.runTrackId!, track);
            if (track.segments && track.segments.length > 0) {
              this.mapComponent.displayGpsTrack(result.runId, track.segments, result.participantNickname);
              callback();
            }
          }
        },
        error: (err) => console.error('Error fetching GPS track', err)
      });
    }

    onTrackClicked(runId: string) {
      if (this.highlightedRunId && this.highlightedRunId !== runId) {
        this.mapComponent.unhighlightTrack(this.highlightedRunId);
      }
      this.mapComponent.highlightTrack(runId);
      this.highlightedRunId = runId;

      const row = document.querySelector(`tr[data-run-id="${runId}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    private fetchAndDisplayTracksForExpanded() {
      const expandedRunIds = Object.keys(this.expandedRows).filter(id => this.expandedRows[id]);
      const expandedResults = this.raceResults.filter(r => expandedRunIds.includes(r.runId));

      const withoutTrack = expandedResults.filter(r => !r.runTrackId);
      const withTrack = expandedResults.filter(r => r.runTrackId);

      if (withoutTrack.length > 0) {
        this.messageService.add({
          severity: 'info',
          summary: 'Brak tras',
          detail: `Brak trasy GPS dla ${withoutTrack.length} z ${expandedResults.length} rozwiniętych uczestników.`,
          life: 4000
        });
      }

      const toFetch: string[] = [];
      for (const result of withTrack) {
        const cached = this.cache.gpsTracks.get(result.runTrackId!);
        if (cached) {
          if (cached.segments && cached.segments.length > 0) {
            this.mapComponent.displayGpsTrack(result.runId, cached.segments, result.participantNickname);
          }
        } else {
          toFetch.push(result.runTrackId!);
        }
      }

      if (toFetch.length > 0) {
        this.backofficeSendService.getGpsTrackBatch(toFetch).subscribe({
          next: (tracks) => {
            const trackMap = new Map(tracks.map(t => [t.runId, t]));
            for (const result of withTrack) {
              const trackId = result.runTrackId!;
              if (!toFetch.includes(trackId)) continue;
              const track = trackMap.get(trackId);
              if (track) {
                this.cache.gpsTracks.set(trackId, track);
                if (track.segments && track.segments.length > 0) {
                  this.mapComponent.displayGpsTrack(result.runId, track.segments, result.participantNickname);
                }
              }
            }
          },
          error: () => {
            this.messageService.add({
              severity: 'warn',
              summary: 'Błąd',
              detail: 'Nie udało się pobrać tras GPS.',
              life: 4000
            });
          }
        });
      }
    }

    private displayTrackFromCache(runId: string) {
      const result = this.raceResults.find(r => r.runId === runId);
      if (!result?.runTrackId) return;

      const cached = this.cache.gpsTracks.get(result.runTrackId);
      if (cached && cached.segments && cached.segments.length > 0) {
        this.mapComponent.displayGpsTrack(runId, cached.segments, result.participantNickname);
      }
    }

    private refreshResults() {
      let request = {
        filter: undefined,
        pageNumber: 0
      };
      this.backofficeSendService.getRaceResults(request).subscribe({
        next: (data) => {
          this.allRaceResults = data;
          this.raceResults = data;
          this.cache.raceResults = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error refreshing results', err);
          this.isLoading = false;
        }
      });
    }
  }
