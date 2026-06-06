import api from './api';
import { IAnimal } from '../types';

/**
 * TelemetryService — Handles ingestion of real-time or historical IoT data from MongoDB.
 */
const telemetryService = {
  getAnimals: async (): Promise<IAnimal[]> => {
    const response = await api.get('/sheep', { params: { limit: 1000 } });
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response.data?.sheep)) return response.data.sheep;
    return []; // Expecting Array<IAnimal>
  },

  getAlerts: async (): Promise<any[]> => {
    const response = await api.get('/alerts', { params: { limit: 50 } });
    const raw: any[] = response.data?.alerts ?? [];
    return raw.map((a: any) => ({
      id: a._id || a.id || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: (a.type || 'HEALTH_WARNING').toUpperCase(),
      collar_id: a.sheepId || a.collar_id || 'N/A',
      animal_name: a.sheepId || a.animal_name || 'Inconnu',
      severity: (['CRITICAL', 'WARNING', 'INFO'].includes((a.severity || '').toUpperCase())
        ? (a.severity as string).toUpperCase()
        : 'WARNING') as 'CRITICAL' | 'WARNING' | 'INFO',
      timestamp: a.createdAt || a.timestamp || new Date().toISOString(),
      read: Boolean(a.read),
      message: a.message,
      source: 'socket' as const,
    }));
  },

  getAnimalHistory: async (collar_id: string): Promise<any[]> => {
    const response = await api.get(`/telemetry/${collar_id}/history`);
    return response.data; // Expecting Array<[lat, lng]>
  }
};

export default telemetryService;
