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

export interface TelemetryQueryParams {
    from?: string
    to?: string
    limit?: number
}

interface TelemetryHistoryEnvelope {
    data?: TelemetryPoint[]
    telemetry?: TelemetryPoint[]
    history?: TelemetryPoint[]
}

const parseTelemetryPayload = (payload: unknown): TelemetryPoint[] => {
    if (Array.isArray(payload)) {
        return payload as TelemetryPoint[]
    }

    if (payload && typeof payload === 'object') {
        const response = payload as TelemetryHistoryEnvelope
        if (Array.isArray(response.data)) return response.data
        if (Array.isArray(response.telemetry)) return response.telemetry
        if (Array.isArray(response.history)) return response.history
    }

    return []
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

    getTelemetry: async (id: string, params?: TelemetryQueryParams) => {
        const res = await api.get(`/telemetry/${id}/history`, { params })
        return parseTelemetryPayload(res.data)
    },

    archive: async (id: string) => {
        const res = await api.delete(`/sheep/${id}`)
        return res.data as { message?: string }
    }
}

export default animalsService
