import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';


@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './welcome-screen.component.html',
  styleUrls: []
})
export class WelcomeScreenComponent {
    constructor(private router: Router) {}

  navigateToOrganizer(): void {
    this.router.navigate(['/organizer']);
  }

  navigateToParticipant(): void {
    this.router.navigate(['/participant/sign_in']);
  }
}