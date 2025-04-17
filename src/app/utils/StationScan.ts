export type StationScan = {
    stationId: string | null,
    type: string | null,
    routeName: string | null,
    runId: string | null,
    nickname: string | null,
    team: string | null,
    location: { lat: string; lng: string, accuracy: string },
    scanTimestamp: string | null,
    synced: boolean
  }