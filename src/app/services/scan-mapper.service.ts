import { DodoTest } from "../utils/DodoTest";
import { QrData } from "../utils/QrData";

// dodo slownikowane i cache
export const ROUTE_NAMES: Map<string, string> = new Map([
    ['w', 'WYJADACZE'],
    ['ex', 'EXTREME']
])

// dodo slownikowane i cache
export const STATION_TYPES: Map<string, string> = new Map([
    ['sr', 'START_RUN'],
    ['c', 'CHECKPOINT'],
    ['fr', 'FINISH_RUN']
])

export function getOrNull(map: Map<string, string>, key: string): string | null {
    return map.has(key) ? map.get(key)! : null;
}

declare global{
    interface Map<K,V> {
        getOrNull(key: K): V | null;
    }
}
Map.prototype.getOrNull = function<K,V>(this: Map<K,V>, key: K): V | null {
    return this.has(key) ? this.get(key)! : null;
}