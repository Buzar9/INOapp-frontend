export type Station = {
    type: string,
    geometry: StationGeometry,
    properties: { [key: string]: string }
}

export type StationGeometry = {
    type: string,
    coordinates: number[]
}