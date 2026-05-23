import api from './apiClient'

export type PersistenceMode = 'api' | 'local'
export const PERSISTENCE_MODE: PersistenceMode = (import.meta.env.VITE_PERSISTENCE_MODE === 'local' ? 'local' : 'api')

export interface TelemetryPoint {
    timestamp: string
    temperature: number
    heartRate: number
    activity: number
    battery: number
    lat: number
    lng: number
    rssi: number
}

const animalsService = {
    getAll: async () => {
        const res = await api.get('/animals')
        return res.data
    },

    getById: async (id: string) => {
        const res = await api.get(`/animals/${id}`)
        return res.data
    },

    getTelemetry: async (id: string, params?: { from?: string; to?: string; limit?: number }) => {
        const res = await api.get(`/animals/${id}/telemetry`, { params })
        return res.data as TelemetryPoint[]
    }
}

export default animalsService
