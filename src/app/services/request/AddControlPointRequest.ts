export type AddControlPointRequest = {
    runId: string,
    stationId: string,
    location: { lat: string; lng: string, accuracy: string },
    timestamp: string
}