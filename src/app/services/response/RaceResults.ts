import { GeoView } from "./GeoView"

export type RaceResult = {
    participantNickname: string,
    participantUnit: string,
    categoryName: string,
    routeId: string,
    status: string,
    startTime: string,
    finishTime: string,
    mainTime: string,
    controlPoints: ControlPoint[]
}

export type ControlPoint = {
    stationId: string,
    name: string,
    type: string,
    timestamp: number,
    ruleValidation: RuleValidation[]
    // dodo z jakiegos powodu przy odbiorze z backendu nie jest mapowany na obiekt tylko nazwy zostaja jak na backendzie
    geoView: GeoView,
}

export type RuleValidation = {
    type: string,
    result: string
}