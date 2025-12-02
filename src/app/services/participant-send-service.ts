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
import { GpsTrackPoint, GpsTrackResponse } from "../models/gps-track.model";


@Injectable({
    providedIn: 'root'
})
export class ParticipantSendService {
    // dodo z propertisow
    private apiUrl = 'https://inoapp-backend-845892573651.europe-central2.run.app';

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

    // GPS Track Methods
    uploadGpsTrackBatch(runId: string, points: GpsTrackPoint[]): Observable<{uploadedCount: number, runId: string}> {
        const request = {
            runId: runId,
            points: points.map(p => ({
                timestamp: p.timestamp,
                location: {
                    lat: p.lat,
                    lng: p.lng,
                    accuracy: p.accuracy
                }
            }))
        };
        const url = `${this.apiUrl}/run_trucks/batch`;
        console.log('[ParticipantSendService] Uploading GPS batch to:', url);
        console.log('[ParticipantSendService] Request payload:', request);
        return this.http.post<{uploadedCount: number, runId: string}>(url, request);
    }

    getGpsTrack(runId: string): Observable<GpsTrackResponse> {
        return this.http.post<GpsTrackResponse>(
            `${this.apiUrl}/run_trucks`,
            { runId: runId }
        );
    }
}
