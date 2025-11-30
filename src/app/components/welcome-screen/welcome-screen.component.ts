import { Component, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-welcome-screen',
  standalone: true,
  imports: [ButtonModule, CommonModule],
  templateUrl: './welcome-screen.component.html',
  styleUrls: ['./welcome-screen.component.css']
})
export class WelcomeScreenComponent {
  @Input() showOrganizerOption: boolean = false;

  constructor(private router: Router) {}

  navigateToOrganizer(): void {
    this.router.navigate(['/organizer']);
  }

  navigateToParticipant(): void {
    this.router.navigate(['/participant/sign_in']);
  }
}