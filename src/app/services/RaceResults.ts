export type RaceResult = {
    nickname: string,
    team: string,
    routeName: string,
    competitionCategory: string,
    status: string,
    startTime: string,
    finishTime: string,
    mainTime: string,
    totalTime: string,
    visitedCheckpointsNumber: string,
    validationsStationResult: Dodo[]
}

export type Dodo = {
    checkpointId: string,
    type: string,
    status: string,
    details: string
}