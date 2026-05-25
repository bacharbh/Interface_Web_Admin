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
    const response = await api.get('/notifications');
    return response.data; // Expecting Array<Alert>
  },

  getAnimalHistory: async (collar_id: string): Promise<any[]> => {
    const response = await api.get(`/telemetry/${collar_id}/history`);
    return response.data; // Expecting Array<[lat, lng]>
  }
};

export default telemetryService;
