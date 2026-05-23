import { useState, useEffect, useRef, useMemo } from 'react';
import { WorkerBridge } from '../utils/workerBridge';
import { IWorkerResult, IGeofenceZone, IKpis } from '../types';

/**
 * useWorker — React hook to consume Web Worker data.
 * Offloads geofencing and clustering logic.
 */

export const useWorker = (
  positions: any,
  zones: IGeofenceZone[],
  zoom: number,
  bounds: any = null
) => {
  const [result, setResult] = useState<IWorkerResult>({
    animalList: [],
    clusters: [],
    alerts: [],
    kpis: {
      totalActive: 0,
      safe: 0,
      outOfZone: 0,
      lowBattery: 0,
      critical: 0,
      avgBattery: 0,
      unreadAlerts: 0,
      criticalAlerts: 0,
    } as IKpis,
  });

  const bridgeRef = useRef<WorkerBridge | null>(null);

  // Initialize worker
  useEffect(() => {
    bridgeRef.current = new WorkerBridge();
    
    bridgeRef.current.onMessage((data) => {
      setResult({
        animalList: data.animalList || data.animalsList || [],
        clusters: data.clusters || [],
        alerts: data.alerts || [],
        kpis: data.stats || data.kpis || result.kpis, // Map 'stats' from worker to 'kpis' and fallback to current
      });
    });

    return () => {
      bridgeRef.current?.terminate();
    };
  }, []);

  // Sync data to worker
  useEffect(() => {
    if (!bridgeRef.current) return;

    // Send payload to worker
    bridgeRef.current.postData({
      animals: positions,
      zones,
      zoom,
      bounds,
    });
  }, [positions, zones, zoom, bounds]);

  return result;
};
