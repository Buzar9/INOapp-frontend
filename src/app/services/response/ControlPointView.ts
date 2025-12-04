export interface GeoView {
    lat: number;
    lng: number;
}

export interface RuleValidationView {
    ruleName: string;
    isValid: boolean;
    message?: string;
}

export interface ControlPointView {
    stationId: string;
    name: string;
    type: string;
    timestamp: string;
    ruleValidation: RuleValidationView[];
    geoView: GeoView;
}

// Słownik tłumaczeń typów stanowisk na polski
export const STATION_TYPE_TRANSLATIONS: { [key: string]: string } = {
    'START': 'Start',
    'START_RUN': 'Start biegu',
    'CHECKPOINT': 'Punkt kontrolny',
    'FINISH': 'Meta',
    'FINISH_RUN': 'Meta biegu',
    'HIDDEN': 'Ukryty',
    'BONUS': 'Bonusowy',
    'PENALTY': 'Karny',
    'NEUTRAL': 'Neutralny'
};

export function translateStationType(type: string): string {
    return STATION_TYPE_TRANSLATIONS[type] || type;
}
