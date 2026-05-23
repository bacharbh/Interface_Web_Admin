/**
 * Core types for Smart Shepherd IoT Dashboard.
 */

export type AnimalStatus = 'SAFE' | 'OUT_OF_ZONE' | 'LOW_BATTERY' | 'CRITICAL';
export type HealthStatus = 'Good' | 'Warning' | 'Critical';

export interface IPosition {
  lat: number;
  lng: number;
}

export interface IAnimal {
  collar_id: string;
  name: string;
  lat: number;
  lng: number;
  battery: number;
  health: HealthStatus;
  status: AnimalStatus;
  speed?: number;
  temperature?: number;
  heading?: number;
  breed?: string;
  lastUpdate?: string;
  heartRate?: number;
  rssi?: number;
  activity_level?: number;
  tenant_id?: string;
  lstm_score?: number;
  lstm_anomaly_type?: string | null;
  sheepId?: string;
  age?: string | number;
  weight?: string | number;
  sector?: string;
  activity?: number;
  [key: string]: any;
}

export interface IGeofenceZone {
  id: number;
  name: string;
  coords: [number, number][]; // Array of [lat, lng]
  color: string;
  type?: 'safe' | 'exclusion' | 'alert';
  animalCount?: number;
}

export interface ICluster {
  id: string;
  center: [number, number];
  count: number;
  status: AnimalStatus;
  animalIds: string[];
}

export interface IKpis {
  totalActive: number;
  safe: number;
  outOfZone: number;
  lowBattery: number;
  critical: number;
  avgBattery: number;
  unreadAlerts: number;
  criticalAlerts: number;
}

export interface IWorkerPayload {
  animals: Record<string, IAnimal>;
  zones: IGeofenceZone[];
  zoom: number;
  bounds: {
    northWest: [number, number];
    southEast: [number, number];
  };
}

export interface IWorkerResult {
  animalList: IAnimal[];
  clusters: ICluster[];
  alerts: any[];
  kpis: IKpis;
}
