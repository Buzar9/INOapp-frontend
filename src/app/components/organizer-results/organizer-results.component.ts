import { Component, OnInit } from '@angular/core';
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
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { BackgroundMapOption } from '../../services/response/BackgroundMapOption';
import { Select } from 'primeng/select';
import { BackgroundMap } from '../../services/response/BackgroundMap';

@Component({
  selector: 'app-organizer-results',
  standalone: true,
  imports: [CommonModule, ScrollPanelModule, Select, TableModule, BackofficeMapComponent, TagModule, ButtonModule, SplitterModule, MultiSelectModule, FormsModule, ReactiveFormsModule],
  templateUrl: './organizer-results.component.html',
  styles: []
})
export class OrganizerResultsComponent implements OnInit {
  raceResults: RaceResult[] = [];
  routes: Route[] = []
  expandedRows: { [key: string]: boolean } = {};
  selectedControlPoints: ControlPoint[] = [];
  selectedRouteStations: Station[] = []
  
  filterForm: FormGroup
  teamOptions: string[] = []
  categoryOptions: string[] = []
  statusOptions: DictionaryModel[] = []

  backgroundMapsOptions: BackgroundMapOption[] = [];
  backgroundMaps: BackgroundMap[] = [];
  selectedBackgroundMap: BackgroundMap | undefined;

  constructor(
    private backofficeSendService: BackofficeSendService, 
    private formBuilder: FormBuilder,
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

    this.backofficeSendService.getRaceResults(initRequest).subscribe({
      next: (data) => {
        this.raceResults = data;
      },
      error: (err) => {
        console.error('dodo error get', err);
      }
    })

    let request = {competitionId: 'Competition123'}
    this.backofficeSendService.getRoutes(request).subscribe({
      next: (routes) => this.routes = routes,
      error: (err) => console.error('dodo err', err)
    })

    this.backofficeSendService.getCategories().subscribe({
      next: (categories) => this.categoryOptions = categories.map(category => category.name),
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

    onRowExpand(event: TableRowExpandEvent) {
      this.selectedControlPoints = [...this.selectedControlPoints, ...event.data.controlPoints];
      this.selectedRouteStations = this.routes.find(route => route.id === event.data.routeId)?.stations ?? []
    }

    onRowCollapse(event: TableRowCollapseEvent) {
      const collapsedControlPoints = event.data.controlPoints;
      this.selectedControlPoints = this.selectedControlPoints.filter(cp => !collapsedControlPoints.includes(cp));
      this.selectedRouteStations = []
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

      this.backofficeSendService.getRaceResults(filterRequest).subscribe({
        next: (data) => {
          this.raceResults = data;
        },
        error: (err) => {
          console.error('dodo error get', err);
        }
      })
    }

    async changeMap(event: any) {
      const selectedMapId = event.value;
      this.selectedBackgroundMap = this.backgroundMaps.find(map => map.id === selectedMapId);
    }
  }
