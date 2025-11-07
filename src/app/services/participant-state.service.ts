import { Injectable } from '@angular/core';
import { run } from 'node:test';
// dodo kod działa ale jest bardzo brzydki
@Injectable({ providedIn: 'root' })
export class ParticipantStateService {
  competitionId: string = '';
  participantUnit: string = '';
  categoryId: string = '';
  participantName: string = '';
  runId: string = '';
  
  setOrganizationData(data: { competitionId: string, participantUnit: string, categoryId: string }) {
    this.competitionId = data.competitionId;
    this.participantUnit = data.participantUnit;
    this.categoryId = data.categoryId;
  }

  setParticipantName(data: {participantName: string}) {
    this.participantName = data.participantName;
  }

  setRunId(runId: string) {
    this.runId = runId
  }

  getData() {
    return { 
      competitionId: this.competitionId,
      categoryId: this.categoryId,
      participantName: this.participantName,
      participantUnit: this.participantUnit,
     };
  }

  getRunId() {
    return this.runId
  }

  clear() {
    this.competitionId = '';
    this.participantName = '';
    this.participantUnit = '';
    this.categoryId = '';
    this.runId = '';
  }
}
