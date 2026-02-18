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
import { ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-organizer-results',
  standalone: true,
  imports: [CommonModule, ScrollPanelModule, Select, TableModule, BackofficeMapComponent, TagModule, ButtonModule, SplitterModule, MultiSelectModule, FormsModule, ReactiveFormsModule, ProgressSpinnerModule, DialogModule, DatePicker, ConfirmDialogModule],
  providers: [ConfirmationService],
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
  `]
})
export class OrganizerResultsComponent implements OnInit {
  @ViewChild(BackofficeMapComponent) mapComponent!: BackofficeMapComponent;
  accuracyVisible = true;
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

  constructor(
    private backofficeSendService: BackofficeSendService,
    private formBuilder: FormBuilder,
    private confirmationService: ConfirmationService,
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

    this.isLoading = true;
    this.backofficeSendService.getRaceResults(initRequest).subscribe({
      next: (data) => {
        this.raceResults = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('dodo error get', err);
        this.isLoading = false;
      }
    })

    let request = {competitionId: 'Competition123'}
    this.backofficeSendService.getRoutes(request).subscribe({
      next: (routes) => this.routes = routes,
      error: (err) => console.error('dodo err', err)
    })

    this.backofficeSendService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.categoryOptions = categories.map(category => category.name);
      },
      error: (err) => console.error('dodo err', err)
    })

    this.backofficeSendService.getUnits().subscribe({
      next: (units) => this.teamOptions = units.map(unit => unit.name),
      error: (err) => console.error('dodo err', err)
    })

    this.backofficeSendService.getStatusDictionary().subscribe({
      next: (response) => this.statusOptions = response,
      error: (err) => console.error('dodo err', err)
    })

    this.backofficeSendService.getBackgroundMapOptions(request).subscribe ({
      next: (response) => this.backgroundMapsOptions = response,
      error: (err) => console.log('dodo problem dodo', err)
    })

    this.backofficeSendService.getBackgroundMaps(request).subscribe ({
      next: (response) => this.backgroundMaps = response,
      error: (err) => console.log('dodo  dodo', err)
    })
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
      } else {
        this.expandedRows = {};
        this.selectedControlPoints = [];
        for (const result of this.raceResults) {
          this.expandedRows[result.runId] = true;
          const cps = result.controlPoints.map(cp => ({ ...cp, participantNickname: result.participantNickname, participantUnit: result.participantUnit, categoryName: result.categoryName }));
          this.selectedControlPoints = [...this.selectedControlPoints, ...cps];
        }
      }
      this.allExpanded = !this.allExpanded;
    }

    onRowExpand(event: TableRowExpandEvent) {
      const cps = event.data.controlPoints.map((cp: ControlPoint) => ({ ...cp, participantNickname: event.data.participantNickname, participantUnit: event.data.participantUnit, categoryName: event.data.categoryName }));
      this.selectedControlPoints = [...this.selectedControlPoints, ...cps];
    }

    onRowCollapse(event: TableRowCollapseEvent) {
      const collapsedNames = new Set(event.data.controlPoints.map((cp: ControlPoint) => cp.name));
      const nickname = event.data.participantNickname;
      this.selectedControlPoints = this.selectedControlPoints.filter(
        cp => !(collapsedNames.has(cp.name) && cp.participantNickname === nickname)
      );
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
      const categoryFilters: string[] = formValues.categorySelectedOptions ? formValues.categorySelectedOptions : []
      const statusFilters: string[] = formValues.statusSelectedOptions ? formValues.statusSelectedOptions : []

      let filter: { [key: string]: string[] } = {
        'team': teamFilters,
        'category': categoryFilters,
        'status': statusFilters
      };

      let filterRequest = {
        filter: filter,
        pageNumber: 0
      }

      this.isLoading = true;
      this.backofficeSendService.getRaceResults(filterRequest).subscribe({
        next: (data) => {
          this.raceResults = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('dodo error get', err);
          this.isLoading = false;
        }
      })
    }

    changeMap(event: any) {
      this.selectedBackgroundMapId = event.value;
      this.selectedBackgroundMap = this.backgroundMaps.find(map => map.id === this.selectedBackgroundMapId);
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

    private refreshResults() {
      let request = {
        filter: undefined,
        pageNumber: 0
      };
      this.backofficeSendService.getRaceResults(request).subscribe({
        next: (data) => {
          this.raceResults = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error refreshing results', err);
          this.isLoading = false;
        }
      });
    }
  }
