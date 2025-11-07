import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { InitiateRunRequest } from "./request/InitiateRunRequest";
import { StartRunRequest } from "./request/StartRunRequest";
import { AddCheckpointRequest } from "./request/AddCheckpointRequest";
import { FinishRunRequest } from "./request/FinishRunRequest";
import { GetRouteRequest } from "./request/GetRouteRequest";
import { Route } from "./response/Route";
import { InitiateRunResponse } from "./response/InitiateRunResponse";
import { AddControlPointRequest } from "./request/AddControlPointRequest";
import { RunMetricAfterControlPoint } from "./response/RunMetricAfterControlPoint";
import { Header } from "primeng/api";
import { GetBackgroundMapRequest, GetStationsRequest } from "./backoffice-requests";
import { Station } from "./response/Station";
import { BackgroundMap } from "./response/BackgroundMap";


@Injectable({
    providedIn: 'root'
})
export class ParticipantSendService {
    // dodo z propertisow
    private apiUrl = 'http://localhost:8080';

    constructor(private http: HttpClient) {}

    initiateRun(request: InitiateRunRequest): Observable<InitiateRunResponse> {
        return this.http.post<InitiateRunResponse>(`${this.apiUrl}/runs/initiate`, request);
    }

    // startRun(request: StartRunRequest): Observable<any> {
    //     return this.http.post<any>(`${this.apiUrl}/start`, request);
    // }

    // addCheckpoint(request: AddCheckpointRequest): Observable<any> {
    //     return this.http.post<any>(`${this.apiUrl}/add_checkpoint`, request);
    // }

    // finishRun(request: FinishRunRequest): Observable<any> {
    //     return this.http.post<any>(`${this.apiUrl}/finish`, request);
    // }

    // dodo RouteSendService
    getRoute(request: GetRouteRequest): Observable<Route> {
        return this.http.post<Route>(`${this.apiUrl}/routes`, request, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
    }

    getStations(request: GetStationsRequest): Observable<Station[]> {
        return this.http.post<Station[]>(`${this.apiUrl}/categories/stations`, request)
    }

    addControlPoint(request: AddControlPointRequest): Observable<RunMetricAfterControlPoint> {
        return this.http.post<RunMetricAfterControlPoint>(`${this.apiUrl}/runs/add_control_point`, request)
    }

    getBackgroundMap(request: GetBackgroundMapRequest): Observable<BackgroundMap> {
        return this.http.post<BackgroundMap>(`${this.apiUrl}/background_maps`, request)
    }
}