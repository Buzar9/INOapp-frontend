export type BackgroundMap = {
    name: string,
    id: string,
    fileUrl: string,
    minZoom: number,
    maxZoom: number,
    northEast: [number, number],
    southWest: [number, number]
}