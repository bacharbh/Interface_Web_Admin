import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import animalsService, { PERSISTENCE_MODE as ANIM_PERSIST } from '../services/animalsService'

export const useAnimals = (params?: Record<string, any>) => {
    useEffect(() => {
        if (import.meta.env.VITE_PERSISTENCE_MODE === 'api' && typeof indexedDB !== 'undefined') {
            try {
                indexedDB.deleteDatabase('last_known_devices')
                indexedDB.deleteDatabase('smart-shepherd-cache')
            } catch {
                // silent — not critical
            }
        }
    }, [])

    const queryFn = () => animalsService.getAll()

    return useQuery({ queryKey: ['animals'], queryFn, staleTime: 30_000, gcTime: 0 })
}

export const useAnimalTelemetry = (id: string, params?: Record<string, any>) => {
    const queryFn = ANIM_PERSIST === 'api'
        ? () => animalsService.getTelemetry(id, params)
        : () => Promise.resolve([])

    return useQuery({ queryKey: ['animal', id, 'telemetry', params], queryFn, enabled: !!id })
}

export default useAnimals
