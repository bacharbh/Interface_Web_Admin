import type { Alert } from '../hooks/useIoTStore';
import type { IAnimal } from '../types';

export interface PredictionFixture {
    sheepId: string;
    collar_id?: string;
    name: string;
    breed: string;
    age: number;
    anomalies: { anomalies: Array<{ timestamp: string; type: string; severity: string; score: number; values: Record<string, unknown> }>; riskScore: number };
    healthPrediction: { prediction: { predictedValues: { heartRate: number; temperature: number; battery: number; signalStrength: number; activity: string }; riskScore: number; issues: string[]; trend: string }; confidence: number };
    riskScore: { overallScore: number; level: 'low' | 'medium' | 'high' | 'critical'; components: { anomalies: number; prediction: number; trends: number; base: number }; recommendations: string[] };
}

export const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({ id: 'alert-1', type: 'LOW_BATTERY', collar_id: 'COLLAR-1', animal_name: 'Brebis 1', severity: 'WARNING', timestamp: '2026-05-22T10:00:00.000Z', read: false, source: 'socket', ...overrides });

export const makeAnimal = (overrides: Partial<IAnimal> = {}): IAnimal => ({ collar_id: 'COLLAR-1', name: 'Brebis 1', lat: 34, lng: -6, battery: 80, health: 'Good', status: 'SAFE', ...overrides });

export const makePrediction = (overrides: Partial<PredictionFixture> = {}): PredictionFixture => ({ sheepId: 'sheep-1', name: 'Brebis 1', breed: 'Ouled Djellal', age: 2, anomalies: { anomalies: [], riskScore: 10 }, healthPrediction: { prediction: { predictedValues: { heartRate: 80, temperature: 39, battery: 88, signalStrength: 92, activity: 'normal' }, riskScore: 20, issues: [], trend: 'stable' }, confidence: 90 }, riskScore: { overallScore: 20, level: 'low', components: { anomalies: 0, prediction: 0, trends: 0, base: 20 }, recommendations: ['Surveillance recommandée'] }, ...overrides });