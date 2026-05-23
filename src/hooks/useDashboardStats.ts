import { useQuery } from '@tanstack/react-query'
import animalsService from '../services/animalsService'

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            if (import.meta.env.VITE_PERSISTENCE_MODE === 'local') {
                return { totalAnimals: 0, atRisk: 0 }
            }

            const animals = await animalsService.getAll()
            const totalAnimals = Array.isArray(animals) ? animals.length : 0
            const atRisk = totalAnimals > 0 ? Math.floor(totalAnimals * 0.08) : 0
            return { totalAnimals, atRisk }
        }
    })
}

export default useDashboardStats
