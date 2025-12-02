// Frontend-only interface for tracking (stored in IndexedDB)
export interface GpsTrackPoint {
  timestamp: number;
  lat: number;
  lng: number;
  accuracy: number;
  uploadedToBackend: boolean;
}

// Backend response interface (with computed metadata)
export interface GpsTrackPointResponse {
  timestamp: number;
  lat: number;
  lng: number;
  accuracy: number;
}

export interface Velocity {
  value: number;
  unit: 'METERS_PER_SECOND' | 'KILOMETERS_PER_HOUR';
}

export interface GpsTrackSegment {
  point: GpsTrackPointResponse;
  velocity: Velocity;
}

export interface TrackStats {
  totalDistance: number;
  totalDuration: number;
  avgSpeed: Velocity;
  stationaryTime: number;
}

export interface GpsTrackResponse {
  runId: string;
  segments: GpsTrackSegment[];
  stats?: TrackStats;
}

export enum TrackingMode {
  OFF = 'OFF',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  MAX = 'MAX'
}

export interface TrackingConfig {
  enabled: boolean;
  interval: number | null;
  minDistance: number | null;
  accuracy: 'low' | 'balanced' | 'high' | null;
  description: string;
}

export const TRACKING_CONFIGS: Record<TrackingMode, TrackingConfig> = {
  [TrackingMode.OFF]: {
    enabled: false,
    interval: null,
    minDistance: null,
    accuracy: null,
    description: 'Tracking wyłączony'
  },
  [TrackingMode.LOW]: {
    enabled: true,
    interval: 60000,
    minDistance: 50,
    accuracy: 'low',
    description: 'Punkty co minutę, minimalna dokładność'
  },
  [TrackingMode.MEDIUM]: {
    enabled: true,
    interval: 30000,
    minDistance: 25,
    accuracy: 'balanced',
    description: 'Punkty co 30s, średnia dokładność'
  },
  [TrackingMode.HIGH]: {
    enabled: true,
    interval: 15000,
    minDistance: 10,
    accuracy: 'high',
    description: 'Punkty co 15s, wysoka dokładność (zalecane)'
  },
  [TrackingMode.MAX]: {
    enabled: true,
    interval: 5000,
    minDistance: 5,
    accuracy: 'high',
    description: 'Punkty co 5s, maksymalna dokładność'
  }
};

export interface UserTrackingPreferences {
  mode: TrackingMode;
  autoAdjustOnLowBattery: boolean;
  warnBeforeDisabling: boolean;
}
