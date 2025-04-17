import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularFirestore, AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { SendService } from '../../services/send-service';
import { RaceResult } from '../../services/RaceResults';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-organizer-results',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './organizer-results.component.html',
  styles: []
})
export class OrganizerResultsComponent implements OnInit {
  accessGranted = false;
  private readonly allowedKey = 'letmein123'

  raceResults: RaceResult[] = [];
  expandedRowNickname: string | null = null;
  expandedRowData: RaceResult | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private sendService: SendService, private buttonModule: ButtonModule) {}

// dodo paginacja
// wyswietlanie po kategorii i trasie
//  tłumaczenie wszystkich enumum, zeby nie wyciekalo

  ngOnInit(): void {
    const accessKey = this.route.snapshot.paramMap.get('accessKey');
    if (accessKey === this.allowedKey) {
      this.accessGranted = true;
    }

    this.sendService.getRaceResults().subscribe({
      next: (data) => {
        this.raceResults = data;
      },
      error: (err) => {
        console.error('dodo error get', err);
      }
    })
  }

  isRunFinished(status: string): boolean {
    return status === 'FINISHED' || status === 'DISQUALIFIED_BY_TIME'
  }

  toggleRow(result: RaceResult): void { // Zmiana parametru na RaceResult
    if (this.expandedRowNickname === result.nickname) {
      this.expandedRowNickname = null;
      this.expandedRowData = null;
    } else {
      this.expandedRowNickname = result.nickname;
      this.expandedRowData = result; // Ustawienie danych rozwiniętego wiersza
    }
  }

  getStatusIcon(status:string): string {
    // dodo metoda sie wywoluje co sekunde
    switch (status) {
      case 'Pass':
        return 'pi pi-check';
      case 'Fail':
        return 'pi pi-times'
      case 'InsufficientData':
        return 'pi pi-question'
      default:
        return 'pi pi-ban'
    }
  }
}
