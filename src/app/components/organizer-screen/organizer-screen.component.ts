import { Component, OnInit } from "@angular/core";
import { MenuItem } from "primeng/api";
import { MenubarModule } from 'primeng/menubar';
import { RouterOutlet } from '@angular/router';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from "primeng/button";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { TileDbService } from '../../services/tile-db.service';

@Component({
    selector: 'organizer-screen',
    standalone: true,
    imports: [MenubarModule, RouterOutlet, SidebarModule, ButtonModule, CommonModule],
    templateUrl: './organizer-screen.component.html'
})
export class OrganizerScreenComponent {
    visibleSidebar: boolean = false;
    items: MenuItem[] | undefined

    constructor(private router: Router, private tileDb: TileDbService) {
        this.items = [
            {
                label: 'Wyniki',
                icon: 'pi pi-chart-bar',
                routerLink: 'results'
            },
            {
                label: 'Trasy',
                icon: 'pi pi-compass',
                routerLink: 'routes'
            },
            {
                label: 'Kategorie',
                icon: 'pi pi-trophy',
                routerLink: 'categories'
            },
            {
                label: 'Jednostki',
                icon: 'pi pi-shield',
                routerLink: 'units'
            },
            {
                label: 'Mapy',
                icon: 'pi pi-map',
                routerLink: 'maps'
            },
            {
                label: 'Wyloguj',
                icon: 'pi pi-sign-out',
                command: async () => await this.logoutAndClear()
            }
        ]
    }

    private async logoutAndClear(): Promise<void> {
        try {
            // wyczyść wszystkie mapy z IndexedDB
            await this.tileDb.clearAllMaps();
            console.log('IndexedDB maps cleared');
        } catch (err) {
            console.error('Błąd podczas czyszczenia IndexedDB:', err);
            // kontynuujemy wylogowanie nawet jeśli czyszczenie się nie powiodło
        }

        // dotychczasowe zachowanie: przełącz na stronę główną
        this.router.navigateByUrl('/');
    }
}