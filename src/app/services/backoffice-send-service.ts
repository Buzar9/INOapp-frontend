import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { RaceResult } from "./response/RaceResults";
import { AddStationToRouteRequest, CreateCategoryRequest, CreateCompetitionRequest, CreateUnitRequest, DeleteCategoryRequest, DeleteRouteRequest, DeleteStationRequest, DeleteUnitRequest, EditRouteRequest, EditStationRequest, EditUnitRequest } from "./backoffice-requests";
import { CreateRouteRequest } from "./request/CreateRouteRequest"
import { Station } from "../services/response/Station"
import { Route } from "./response/Route";
import { GetAllRoutesRequest } from "./request/GetAllRoutesRequest";
import { Category } from "./response/Category";
import { Unit } from "./response/Unit";
import { DictionaryModel } from "./response/DictionaryModel";
import { CompetitionResultFilterRequest } from "./request/CompetitionResultFilterRequest";
import { BackgroundMapOption } from "./response/BackgroundMapOption";
import { GetAllBackgroundMapsRequest } from "./request/GetAllBackgroundMapsRequest copy";
import { BackgroundMap } from "./response/BackgroundMap";


@Injectable({
    providedIn: 'root'
})
export class BackofficeSendService {

        // dodo z propertisow
        private apiUrl = 'https://inoapp-backend-845892573651.europe-central2.run.app/backoffice';
        // private apiUrl = 'http://localhost:8080/backoffice';

        constructor(private http: HttpClient) {}

    createCompetition(request: CreateCompetitionRequest): Observable<any> {
        return this.http.post(
            `${this.apiUrl}/create`,
            request,

            { responseType: 'text',
                headers: new HttpHeaders({
                    'Content-Type': 'application/json'
                    })
             })
    }

    getRaceResults(request: CompetitionResultFilterRequest): Observable<RaceResult[]> {
        return this.http.post<RaceResult[]>(`${this.apiUrl}/competition/results`, request);
      }

    getStations(): Observable<Station[]> {
      return this.http.get<Station[]>(`${this.apiUrl}/stations`, {headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })})
    }

    getCategories(): Observable<Category[]> {
      return this.http.get<Category[]>(`${this.apiUrl}/categories`)
    }

    getUnits(): Observable<Unit[]> {
      return this.http.get<Unit[]>(`${this.apiUrl}/units`)
    }

    createRoute(request: CreateRouteRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/routes/create`, request)
    }

    createCategory(request: CreateCategoryRequest): Observable<any> {
      return this.http.post<any>(`${this.apiUrl}/categories/create`, request)
    }

    createUnit(request: CreateUnitRequest): Observable<any> {
      return this.http.post<any>(`${this.apiUrl}/units/add`, request)
    }

    editUnit(request: EditUnitRequest): Observable<any> {
      return this.http.post<any>(`${this.apiUrl}/units/edit`, request)
    }

    deleteUnit(request: DeleteUnitRequest): Observable<any> {
      return this.http.post<any>(`${this.apiUrl}/units/delete`, request)
    }

    deleteCategory(request: DeleteCategoryRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/categories/delete`, request)
    }

    addStationToRoute(request: AddStationToRouteRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/routes/add_station`, request)
    }

    editStationToRoute(request: EditStationRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/routes/edit_station`, request)
    }

    deleteStationToRoute(request: DeleteStationRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/routes/delete_station`, request)
    }

    getRoutes(request: GetAllRoutesRequest): Observable<Route[]> {
      return this.http.post<Route[]>(`${this.apiUrl}/routes`, request, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    getRouteOptions(request: GetAllRoutesRequest): Observable<Route[]> {
      return this.http.post<Route[]>(`${this.apiUrl}/routes/options`, request, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    getBackgroundMapOptions(request: GetAllBackgroundMapsRequest): Observable<BackgroundMapOption[]> {
      return this.http.post<BackgroundMapOption[]>(`${this.apiUrl}/background_maps/options`, request, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    getBackgroundMaps(request: GetAllBackgroundMapsRequest): Observable<BackgroundMap[]> {
      return this.http.post<BackgroundMap[]>(`${this.apiUrl}/background_maps`, request, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    editRoute(request: EditRouteRequest): Observable<Route> {
      return this.http.post<Route>(`${this.apiUrl}/routes/edit_route`, request)
    }

    deleteRoute(request: DeleteRouteRequest): Observable<Route[]> {
      return this.http.post<Route[]>(`${this.apiUrl}/routes/delete_route`, request)
    }

    getStationDictionary(): Observable<DictionaryModel[]> {
      return this.http.get<DictionaryModel[]>(`${this.apiUrl}/dictionaries/station`, {headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })})
    }

    getStatusDictionary(): Observable<DictionaryModel[]> {
      return this.http.get<DictionaryModel[]>(`${this.apiUrl}/dictionaries/status`, {headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })})
    }

    uploadBackgroundMap(file: File, metadata: {name: string; minZoom: number; maxZoom: number}) {
      const formData = new FormData();
      formData.append('file', file);

      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

      return this.http.post(`${this.apiUrl}/background_maps/add`, formData, {
        reportProgress: true,
        observe: 'events'
      });
    }
}
