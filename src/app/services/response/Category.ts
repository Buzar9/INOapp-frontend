import { BackgroundMap } from "./BackgroundMap"
import { Station } from "./Station"

export type Category = {
    id: string,
    name: string,
    routeId: string,
    routeName: string,
    maxTime: number,
    backgroundMap: BackgroundMap
}
