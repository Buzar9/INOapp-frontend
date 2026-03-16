export type CompetitionResultFilterRequest = {
    competitionId: string,
    filter?: { [key: string]: string[] },
    pageNumber: number,
}