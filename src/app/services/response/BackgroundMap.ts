export type SizeView = {
    values: Record<string, number>,
    defaultUnit: string,
}

export type BackgroundMap = {
    name: string,
    id: string,
    fileSize: SizeView,
    zoomsSize: Record<number, SizeView>,
    minZoom: number,
    maxZoom: number,
    northEast: [number, number],
    southWest: [number, number]
}