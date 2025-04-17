export type StartRunRequest = {
    runId: string,
    location: { lat: string; lng: string, accuracy: string },
    timestamp: string
}