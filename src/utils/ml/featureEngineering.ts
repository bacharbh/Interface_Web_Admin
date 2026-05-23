import { IAnimal as Animal } from '../../types';

/**
 * ml/featureEngineering.ts — Prépare les données MQTT brutes pour l'ingestion par le modèle LSTM.
 */

// Utilitaire Haversine pour la distance
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Extrait l'heure d'une chaîne HH:MM:SS ou d'une date ISO
const extractHour = (timeStr: string | null | undefined): number => {
  if (!timeStr) return new Date().getHours();
  if (timeStr.includes(':')) {
    return parseInt(timeStr.split(':')[0], 10);
  }
  return new Date(timeStr).getHours();
};

/**
 * Prepares telemetry history for the LSTM model.
 * Shape: [120, 5]
 * Features: [Temp, HeartRate, Activity, Battery, RSSI]
 */
export const prepareTimeSeriesData = (history: Animal[]): number[][] | null => {
  if (!history || history.length === 0) return null;

  const WINDOW_SIZE = 120;
  
  // Clone and ensure we always have exactly WINDOW_SIZE points
  let paddedHistory = [...history];
  
  if (paddedHistory.length < WINDOW_SIZE) {
    const firstPoint = paddedHistory[0];
    const padding = Array(WINDOW_SIZE - paddedHistory.length).fill(firstPoint);
    paddedHistory = [...padding, ...paddedHistory];
  } else if (paddedHistory.length > WINDOW_SIZE) {
    paddedHistory = paddedHistory.slice(paddedHistory.length - WINDOW_SIZE);
  }

  const features: number[][] = [];

  for (let i = 0; i < WINDOW_SIZE; i++) {
    const current = paddedHistory[i];

    // Feature 1: Temperature (Normalized 35-42)
    const rawTemp = current.temperature || 38.5;
    const tempNorm = Math.max(0, Math.min((rawTemp - 35) / 7.0, 1.0));

    // Feature 2: Heart Rate (Normalized 40-140)
    const rawHR = current.heartRate || 75;
    const hrNorm = Math.max(0, Math.min((rawHR - 40) / 100.0, 1.0));

    // Feature 3: Activity Level (0-4)
    const actNorm = (current.activity_level || 1) / 4.0;

    // Feature 4: Battery (0-100)
    const batNorm = (current.battery || 100) / 100.0;

    // Feature 5: RSSI (Normalized -100 to -30)
    const rawRSSI = current.rssi || -50;
    const rssiNorm = Math.max(0, Math.min((rawRSSI + 100) / 70.0, 1.0));

    features.push([tempNorm, hrNorm, actNorm, batNorm, rssiNorm]);
  }

  return features;
};
