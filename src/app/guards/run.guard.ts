import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { ParticipantRunComponent } from '../components/participant-run/participant-run.component';

@Injectable({
  providedIn: 'root'
})
export class RunGuard implements CanDeactivate<ParticipantRunComponent> {
  canDeactivate(component: ParticipantRunComponent): boolean {
    if (component.wasRunActivate && !component.isRunFinished) {
      return false;
    }
    return true;
  }
}
