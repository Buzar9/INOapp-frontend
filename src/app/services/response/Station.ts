export type Station = {
    type: string,
    geometry: StationGeometry,
    properties: { [key: string]: string }
}

export type StationGeometry = {
    type: string,
    coordinates: number[]
}

export type ConsolidatedStationView = {
    id: string,
    name: string,
    type: string,
    note: string,
    accuracy: number,
    isMounted: boolean,
    geometry: StationGeometry,
    routeId: string,
    routeName: string
}
