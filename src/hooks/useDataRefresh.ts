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
            // Skip refreshing from backend when gateway isn't connected and
            // we don't have offline data. This prevents populating the UI
            // with backend (simulated) records when the MQTT gateway is down.
            const state = useIoTStore.getState();
            if (!state.isConnected && !state.isOfflineData) {
                return;
            }
            if (isRefreshingRef.current) return;

            isRefreshingRef.current = true;
            try {
                // Fetch fresh device/animal data from backend
                const response = await api.get('/sheep', { timeout: 10000 });
                if (response?.data && Array.isArray(response.data)) {
                    // Convert API response to device objects
                    const devices: Record<string, any> = {};
                    response.data.forEach((animal: any) => {
                        const id = animal.collar_id || animal.id;
                        if (!id) return;
                        devices[id] = {
                            id,
                            collar_id: animal.collar_id || animal.id,
                            name: animal.name,
                            lat: typeof animal.lat === 'number' ? animal.lat : undefined,
                            lng: typeof animal.lng === 'number' ? animal.lng : undefined,
                            battery: typeof animal.battery === 'number' ? animal.battery : undefined,
                            temperature: typeof animal.temperature === 'number' ? animal.temperature : undefined,
                            heartRate: typeof (animal.heart_rate ?? animal.heartRate) === 'number' ? (animal.heart_rate ?? animal.heartRate) : undefined,
                            health: animal.health,
                            status: animal.status,
                            activity: typeof animal.activity === 'number' ? animal.activity : undefined,
                            lastSeen: animal.lastSeen || animal.lastUpdate || animal.updatedAt,
                            lastUpdate: animal.lastUpdate || animal.lastSeen || animal.updatedAt,
                            updatedAt: animal.updatedAt || animal.lastUpdate || animal.lastSeen,
                        };
                    });
                    setDevices(devices);
                }
            } catch (error: any) {
                void error;
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
