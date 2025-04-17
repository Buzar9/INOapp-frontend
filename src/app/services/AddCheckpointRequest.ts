export type AddCheckpointRequest = {
    runId: string,
    checkpointId: string,
    routeName: string,
    location: { lat: string; lng: string, accuracy: string },
    timestamp: string
}