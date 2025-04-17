import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { StationScan } from "../utils/StationScan";
import { Observable } from "rxjs";
import { InitiateRunRequest } from "./InitiateRunRequest";
import { StartRunRequest } from "./StartRunRequest";
import { AddCheckpointRequest } from "./AddCheckpointRequest";
import { FinishRunRequest } from "./FinishRunRequest";
import { AddPenaltyRequest } from "./AddPenaltyRequest";
import { RaceResult } from "./RaceResults";


@Injectable({
    providedIn: 'root'
})
export class SendService {
    // dodo z propertisow
    private apiUrl = 'http://localhost:8080/runs';

    constructor(private http: HttpClient) {}

    initiateRun(initiateRunRequest: InitiateRunRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/initiate`, initiateRunRequest);
    }

    startRun(startRunRequest: StartRunRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/start`, startRunRequest);
    }

    addCheckpoint(addCheckpointRequest: AddCheckpointRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/add_checkpoint`, addCheckpointRequest);
    }

    finishRun(finishRunRequest: FinishRunRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/finish`, finishRunRequest);
    }

    addPenalty(addPenaltyRequest: AddPenaltyRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/add_penalty`, addPenaltyRequest);
    }

    getRaceResults(): Observable<RaceResult[]> {
        return this.http.get<RaceResult[]>(`${this.apiUrl}/race_results`);
      }
}