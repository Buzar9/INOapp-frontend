export type AddPenaltyRequest = {
    runId: string,
    penaltyId: string,
    offenseValue: string,
    cause: string,
    timestamp: string
}