import { useMemo, useRef, useEffect } from 'react';
import { useIoTStore } from '../hooks/useIoTStore';
import { useGeofencing } from './useGeofencing';
import { IAnimal, IKpis } from '../types';

/**
 * useRealtimePositions — Provides enriched, memoized position data
 * with computed statuses and KPIs for the entire application.
 */
export function useRealtimePositions(zones: any[] = []) {
  const positions = useIoTStore(state => state.devices);
  const alerts = useIoTStore(state => state.alerts);
  const isConnected = useIoTStore(state => state.isConnected);
  const history = useIoTStore(state => state.history);

  const { getAnimalGeofenceStatus } = useGeofencing(zones);

  // Store previous positions for animation interpolation
  const previousPositionsRef = useRef<Record<string, { prev: { lat: number, lng: number }, current: { lat: number, lng: number }, timestamp: number }>>({});

  // Update previous positions whenever positions change
  useEffect(() => {
    const prev = previousPositionsRef.current;
    const next: any = {};
    Object.entries(positions).forEach(([id, animal]) => {
      if (typeof animal.lat !== 'number' || typeof animal.lng !== 'number') return;
      const lat = animal.lat;
      const lng = animal.lng;
      next[id] = {
        prev: prev[id]?.current || { lat, lng },
        current: { lat, lng },
        timestamp: Date.now(),
      };
    });
    previousPositionsRef.current = next;
  }, [positions]);

  // Compute enriched animal data with status
  const enrichedAnimals = useMemo(() => {
    const result: Record<string, IAnimal & { status: string; batteryLow: boolean; isCritical: boolean }> = {};
    Object.entries(positions).forEach(([id, animal]) => {
      const geofenceStatus = getAnimalGeofenceStatus(animal);
      const battery = animal.battery ?? 0;
      const batteryLow = battery < 20;
      const isCritical = animal.health === 'Critical' || battery < 10;

      let status = 'SAFE';
      if (isCritical) status = 'CRITICAL';
      else if (geofenceStatus === 'OUT_OF_ZONE') status = 'OUT_OF_ZONE';
      else if (batteryLow) status = 'LOW_BATTERY';

      result[id] = {
        ...(animal as any),
        status,
        geofenceStatus,
        batteryLow,
        isCritical,
      };
    });
    return result;
  }, [positions, getAnimalGeofenceStatus]);

  // KPI counters
  const kpis = useMemo((): IKpis => {
    const animals = Object.values(enrichedAnimals);
    const unreadAlerts = alerts.filter(a => !a.read);

    return {
      totalActive: animals.length,
      safe: animals.filter(a => a.status === 'SAFE').length,
      outOfZone: animals.filter(a => a.status === 'OUT_OF_ZONE').length,
      lowBattery: animals.filter(a => a.batteryLow).length,
      critical: animals.filter(a => a.isCritical).length,
      avgBattery: animals.length > 0
        ? Math.round(animals.reduce((sum, a) => sum + (a.battery ?? 0), 0) / animals.length)
        : 0,
      unreadAlerts: unreadAlerts.length,
      criticalAlerts: unreadAlerts.filter(a => a.severity === 'CRITICAL').length,
    };
  }, [enrichedAnimals, alerts]);

  return {
    animals: enrichedAnimals,
    animalsList: useMemo(() => Object.values(enrichedAnimals), [enrichedAnimals]),
    positions,
    history,
    alerts,
    kpis,
    isConnected,
    previousPositions: previousPositionsRef.current,
  };
}

export default useRealtimePositions;
