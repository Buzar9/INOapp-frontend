import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class OrganizerStateService {
    competitionName: string = '';
    organizerNickname: string = '';

    setFormdata(data: {competitionName: string, organizerNickname: string}) {
        this.competitionName = data.competitionName;
        this.organizerNickname = data.organizerNickname;
    }

    getFormData() {
        return { competitionName: this.competitionName, organizerNickname: this.organizerNickname}
    }

    clear() {
        this.competitionName = '';
        this.organizerNickname = '';
    }
}