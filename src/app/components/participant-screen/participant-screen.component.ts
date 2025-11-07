import { Component } from "@angular/core";
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'participant-screen',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './participant-screen.component.html',
    styleUrl: './participant-screen.component.css'
})
export class ParticipantScreenComponent{}