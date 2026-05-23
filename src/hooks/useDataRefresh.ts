import { useEffect, useRef } from 'react';
import { useIoTStore } from './useIoTStore';
import api from '../services/api';

/**
 * useDataRefresh — Periodically refreshes all critical data from backend
 * Ensures all dashboard data is always up-to-date
 */
export function useDataRefresh(intervalMs: number = 5000) {
    const setDevices = useIoTStore(state => state.setDevices);
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isRefreshingRef = useRef(false);

    useEffect(() => {
        const refreshData = async () => {
            if (isRefreshingRef.current) return;

            isRefreshingRef.current = true;
            try {
                // Fetch fresh device/animal data from backend
                const response = await api.get('/api/sheep', { timeout: 10000 });
                if (response?.data && Array.isArray(response.data)) {
                    // Convert API response to device objects
                    const devices: Record<string, any> = {};
                    response.data.forEach((animal: any) => {
                        const id = animal.collar_id || animal.id || `device_${Math.random()}`;
                        devices[id] = {
                            id,
                            collar_id: animal.collar_id || animal.id,
                            name: animal.name || `Animal ${id}`,
                            lat: animal.lat || 0,
                            lng: animal.lng || 0,
                            battery: animal.battery ?? 100,
                            temperature: animal.temperature ?? 38,
                            heartRate: animal.heart_rate || animal.heartRate || 75,
                            health: animal.health || 'Good',
                            status: animal.status || 'SAFE',
                            activity: animal.activity || 0,
                            timestamp: Date.now(),
                        };
                    });
                    setDevices(devices);
                }
            } catch (error: any) {
                // Silently log errors to avoid spamming console
                if (error?.response?.status !== 429) {
                    console.debug('[useDataRefresh] Failed to fetch latest data:', error?.message);
                }
            } finally {
                isRefreshingRef.current = false;
            }
        };

        // Perform initial refresh
        refreshData();

        // Set up periodic refresh
        refreshTimerRef.current = setInterval(refreshData, intervalMs);

        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, [intervalMs, setDevices]);
}

export default useDataRefresh;
