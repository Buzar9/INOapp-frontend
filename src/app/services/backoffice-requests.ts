export type CreateCompetitionRequest = {
    signature: string,
    adminPassword: string,
    organizerNickname: string
}

export type AddStationToRouteRequest = {
    routeId: string,
    name: string,
    type: string,
    location: { lat: number; lng: number, accuracy: number },
    note: string
}

export type EditStationRequest = {
    routeId: string,
    stationId: string,
    name: string,
    type: string,
    location: { lat: number; lng: number, accuracy: number },
    note: string
}

export type DeleteStationRequest = {
    routeId: string,
    stationId: string
}

export type ToggleStationMountRequest = {
    routeId: string,
    stationId: string
}

export type GetStationsRequest = {
    categoryId: string
}

export type EditRouteRequest = {
    routeId: string,
    name: string
}

export type DeleteRouteRequest = {
    routeId: string
}

export type CreateCategoryRequest = {
    name: string,
    competitionId: string,
    routeId: string
}

export type DeleteCategoryRequest = {
    categoryId: string
}

export type CreateUnitRequest = {
    name: string
}

export type EditUnitRequest = {
    id: string,
    name: string
}

export type DeleteUnitRequest = {
    id: string
}

export type GetBackgroundMapRequest = {
    competitionId: string,
    categoryId: string
}

export type DeleteBackgroundMapRequest = {
    backgroundMapId: string
}

export type GetConsolidatedRouteViewRequest = {
    competitionId: string
}