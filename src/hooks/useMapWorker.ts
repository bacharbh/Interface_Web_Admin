import { useState, useEffect, useRef, useCallback } from 'react';
import { IAnimal, IGeofenceZone, IKpis } from '../types';
import MapWorker from '../pages/Map/map.worker?worker';
import { useIoTStore } from './useIoTStore';

export const useMapWorker = (
  animals: Record<string, IAnimal>,
  history: Record<string, IAnimal[]>,
  zones: IGeofenceZone[]
) => {
  const [enrichedAnimals, setEnrichedAnimals] = useState<IAnimal[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [finalAnimals, setFinalAnimals] = useState<IAnimal[]>([]);
  const [kpis, setKpis] = useState<IKpis>({
    totalActive: 0,
    safe: 0,
    outOfZone: 0,
    lowBattery: 0,
    critical: 0,
    avgBattery: 0,
    unreadAlerts: 0,
    criticalAlerts: 0
  });
  const [isReady, setIsReady] = useState(false);

  const workerRef = useRef<Worker | null>(null);

  // Initialize Worker
  useEffect(() => {
    const worker = new MapWorker();
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'READY') {
        setIsReady(true);
      } else if (type === 'BATCH_RESULT') {
        setEnrichedAnimals(payload.enriched || payload.enrichedAnimals || []);
        setClusters(payload.clusters || []);
        setFinalAnimals(payload.finalAnimals || []);
        setKpis(payload.kpis);

        if (payload.newAiAlerts && payload.newAiAlerts.length > 0) {
          const store = useIoTStore.getState();
          payload.newAiAlerts.forEach((alert: any) => store.addAIAlert(alert));
        }
      }
    };

    worker.postMessage({ type: 'INIT' });

    return () => {
      worker.terminate();
    };
  }, []);

  // Send batch for processing
  useEffect(() => {
    if (isReady && workerRef.current) {
      workerRef.current.postMessage({
        type: 'PROCESS_BATCH',
        payload: { animals, history, zones }
      });
    }
  }, [animals, history, zones, isReady]);

  return { enrichedAnimals, clusters, finalAnimals, kpis, isReady };
};
