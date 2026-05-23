import { useQuery } from '@tanstack/react-query'
import animalsService, { PERSISTENCE_MODE as ANIM_PERSIST } from '../services/animalsService'

export const useAnimals = (params?: Record<string, any>) => {
    const queryFn = ANIM_PERSIST === 'api'
        ? () => animalsService.getAll()
        : () => Promise.resolve([])

    return useQuery({ queryKey: ['animals', params], queryFn })
}

export const useAnimalTelemetry = (id: string, params?: Record<string, any>) => {
    const queryFn = ANIM_PERSIST === 'api'
        ? () => animalsService.getTelemetry(id, params)
        : () => Promise.resolve([])

    return useQuery({ queryKey: ['animal', id, 'telemetry', params], queryFn, enabled: !!id })
}

export default useAnimals
