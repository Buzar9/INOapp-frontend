import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ROUTE_NAMES } from '../../services/scan-mapper.service';

@Component({
  selector: 'start-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './start-screen.component.html',
  styleUrls: []
})
export class StartScreenComponent {
  nickname: string = '';
  team: string = '';
  routeName:string = '';
  competitionCategory:string = '';
  // dodo przesiąkanie pseudo-enumow do uzytkownika
  routeNameEntries: [string, string][] = []

  @Output() userSignUp = new EventEmitter<{ nickname: string, team:string, routeName: string, competitionCategory: string }>();

  ngOnInit(){
    this.routeNameEntries = Array.from(ROUTE_NAMES.entries())
  }

  onSubmit(): void {
      localStorage.setItem('nickname', this.nickname);
      localStorage.setItem('team', this.team);
      localStorage.setItem('routeName', this.routeName);
      localStorage.setItem('competitionCategory', this.competitionCategory);
      localStorage.setItem('runId', crypto.randomUUID());
      
      this.userSignUp.emit({
        nickname: this.nickname,
        team: this.team,
        routeName: this.routeName,
        competitionCategory: this.competitionCategory
      });
  }

  get isFormNotCompleted(): boolean {
    return this.nickname.trim() === '' ||
         this.team.trim() === '' ||
         this.routeName.trim() === '' ||
         this.competitionCategory.trim() === '';
}
}
