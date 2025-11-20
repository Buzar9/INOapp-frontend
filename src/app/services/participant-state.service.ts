import { Injectable } from '@angular/core';
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
    console.log('[ParticipantStateService] Organization data set:', data);
  }

  setParticipantName(data: {participantName: string}) {
    this.participantName = data.participantName;
    console.log('[ParticipantStateService] Participant name set:', data.participantName);
  }

  setRunId(runId: string) {
    this.runId = runId;
    console.log('[ParticipantStateService] Run ID set:', runId);
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
    return this.runId;
  }

  clear() {
    console.log('[ParticipantStateService] Clearing all state');
    this.competitionId = '';
    this.participantName = '';
    this.participantUnit = '';
    this.categoryId = '';
    this.runId = '';
  }

  /**
   * Przywraca stan serwisu z localStorage.
   * Używane przy starcie aplikacji aby odzyskać sesję po zamknięciu PWA.
   */
  restoreFromLocalStorage(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[ParticipantStateService] localStorage not available');
      return false;
    }

    const runId = window.localStorage.getItem('runId') || '';
    const categoryId = window.localStorage.getItem('categoryId') || '';
    const competitionId = window.localStorage.getItem('competitionId') || '';
    const participantUnit = window.localStorage.getItem('participantUnit') || '';
    const participantName = window.localStorage.getItem('participantName') || '';

    // Sprawdź czy mamy przynajmniej runId i categoryId (minimum wymagane do przywrócenia sesji)
    if (!runId || !categoryId) {
      console.log('[ParticipantStateService] No valid session found in localStorage');
      return false;
    }

    this.runId = runId;
    this.categoryId = categoryId;
    this.competitionId = competitionId;
    this.participantUnit = participantUnit;
    this.participantName = participantName;

    console.log('[ParticipantStateService] State restored from localStorage:', {
      runId,
      categoryId,
      competitionId,
      participantUnit,
      participantName
    });

    return true;
  }

  /**
   * Zapisuje aktualny stan do localStorage.
   * Używane jako synchronizacja stanu między serwisem a localStorage.
   */
  saveToLocalStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[ParticipantStateService] localStorage not available');
      return;
    }

    if (this.runId) window.localStorage.setItem('runId', this.runId);
    if (this.categoryId) window.localStorage.setItem('categoryId', this.categoryId);
    if (this.competitionId) window.localStorage.setItem('competitionId', this.competitionId);
    if (this.participantUnit) window.localStorage.setItem('participantUnit', this.participantUnit);
    if (this.participantName) window.localStorage.setItem('participantName', this.participantName);

    console.log('[ParticipantStateService] State saved to localStorage');
  }
}
