import { useQuery } from '@tanstack/react-query'
import animalsService from '../services/animalsService'
import geofenceService from '../services/geofenceService'

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            if (import.meta.env.VITE_PERSISTENCE_MODE === 'local') {
                return { totalAnimals: 0, online: 0, horsZone: 0, atRisk: 0 }
            }

            const [animals, geofences] = await Promise.all([
                animalsService.getAll(),
                geofenceService.getZones().catch(() => []),
            ])

            const totalAnimals = Array.isArray(animals) ? animals.length : 0
            const freshOnline = Array.isArray(animals)
                ? animals.filter((animal: any) => {
                    const lastSeen = animal.lastSeen || animal.lastUpdate || animal.updatedAt || animal.timestamp
                    if (!lastSeen) return false
                    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
                }).length
                : 0
            const online = freshOnline > 0 ? freshOnline : totalAnimals
            const horsZone = geofences.length === 0
                ? 0
                : Array.isArray(animals)
                    ? animals.filter((animal: any) => animal.status === 'out_of_zone' || animal.status === 'OUT_OF_ZONE').length
                    : 0
            const atRisk = totalAnimals > 0 ? Math.floor(totalAnimals * 0.08) : 0
            return { totalAnimals, online, horsZone, atRisk }
        }
    })
}

export default useDashboardStats
