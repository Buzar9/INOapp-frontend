import { BackgroundMap } from "./BackgroundMap"
import { Station } from "./Station"

export type Route = {
    id: string,
    name: string,
    stations: Station[],
    backgroundMap: BackgroundMap
}