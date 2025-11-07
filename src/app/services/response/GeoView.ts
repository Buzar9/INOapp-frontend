export type GeoView = {
    type: string,
    geometry: Geometry,
    properties: { [key: string]: string }
}

export type Geometry = {
    type: string,
    coordinates: number[]
}