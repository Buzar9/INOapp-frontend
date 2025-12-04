import { ControlPointView } from './ControlPointView';

export type RunMetricAfterControlPoint = {
    startTime: number,
    finishTime: number,
    mainTime: number,
    controlPoints: ControlPointView[],
    checkpointsNumber: number,
    wasActivate: boolean,
    isFinished: boolean,
}