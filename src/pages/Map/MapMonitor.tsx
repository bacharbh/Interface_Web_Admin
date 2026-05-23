import React, { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useMqtt } from '../../contexts/MqttContext';
import { useIoTStore } from '../../hooks/useIoTStore';
import { useRealtimePositions } from '../../hooks/useRealtimePositions';
import { setSimulationCenter, stopSimulation, startSimulation } from '../../utils/simulation';
import geofenceService from '../../services/geofenceService';
import ProfilingWrapper from './ProfilingWrapper';
import MapSidebar from './MapSidebar';
import { IGeofenceZone } from '../../types';
import GeofencePanel from './GeofencePanel';
import Button from '../../components/ui/Button';
import { Maximize2, Minimize2 } from 'lucide-react';
import MapErrorBoundary from '../../components/map/MapErrorBoundary';

const LazyRealTimeMap = React.lazy(() => import('./RealTimeMap'));

type ZoneType = NonNullable<IGeofenceZone['type']>;

const ZONE_COLORS: Record<ZoneType, string> = {
  safe: '#16a34a',
  exclusion: '#f59e0b',
  alert: '#ef4444',
};

const isPointInPolygon = (lat: number, lng: number, polygon: [number, number][]) => {
  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
};

const showRetryToast = (message: string, onRetry: () => void) => {
  toast.custom((t) => (
    <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200 bg-white p-4 shadow-2xl dark:border-red-500/30 dark:bg-card-dark">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Échec de sauvegarde</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{message}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => toast.dismiss(t.id)}>
          Fermer
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            toast.dismiss(t.id);
            onRetry();
          }}
        >
          Réessayer
        </Button>
      </div>
    </div>
  ));
};

export default function MapMonitor() {
  const [zones, setZones] = useState<IGeofenceZone[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [mapRetryToken, setMapRetryToken] = useState(0);
  const [focusMap, setFocusMap] = useState(() => {
    try {
      return localStorage.getItem('mapFocus') === '1';
    } catch (e) {
      return false;
    }
  });

  // State Layer Info (Zustand) - Now using the reactive hook for all-in-one data
  const { animalsList, history, kpis, isConnected: iotConnected, isSimulation: iotSim } = useRealtimePositions(zones);


  // Keep local simulation state from MQTT context for UI consistency
  const { isSimulation: mqttSim, isConnected: mqttConnected } = useMqtt();
  const isSimulation = mqttSim || iotSim;
  const isConnected = mqttConnected || iotConnected;

  const [viewport, setViewport] = useState({ zoom: 14, bounds: null });

  const zoneSummaries = useMemo(() => {
    return zones.map((zone) => {
      const type = zone.type || 'safe';
      const animalCount = animalsList.filter((animal) => {
        if (typeof animal.lat !== 'number' || typeof animal.lng !== 'number') {
          return false;
        }

        return isPointInPolygon(animal.lat, animal.lng, zone.coords);
      }).length;

      return {
        ...zone,
        type,
        color: zone.color || ZONE_COLORS[type as ZoneType],
        animalCount,
      };
    });
  }, [animalsList, zones]);

  // Geolocation detection to center simulation and map
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log("📍 User Location Found:", latitude, longitude);

        // Update simulation center
        setSimulationCenter(latitude, longitude);
        // Restart simulation to reposition animals
        stopSimulation();
        startSimulation();
      }, (err) => {
        console.warn("⚠️ Geolocation failed or denied:", err.message);
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMap) {
        setFocusMap(false);
        try { localStorage.setItem('mapFocus', '0'); } catch { }
        window.dispatchEvent(new CustomEvent('mapFocusToggled', { detail: false }));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMap]);

  // Fetch zones on mount
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const data = await geofenceService.getZones();
        setZones(data);
      } catch (error) {
        console.error("Failed to fetch zones. Falling back to local/empty.");
      }
    };
    fetchZones();
  }, []);


  const handleSelectAnimal = useCallback((id: string | null) => {
    setSelectedAnimalId(prev => prev === id ? null : id);
  }, []);

  const persistZoneCreate = useCallback(async (zone: IGeofenceZone, tempId: number) => {
    try {
      const savedZone = await geofenceService.createZone(zone);
      const normalizedSavedZone = savedZone || zone;
      setZones((current) => current.map((item) => (item.id === tempId ? {
        ...normalizedSavedZone,
        id: normalizedSavedZone.id ?? tempId,
        type: normalizedSavedZone.type || zone.type || 'exclusion',
        color: normalizedSavedZone.color || zone.color || ZONE_COLORS[(zone.type || 'exclusion') as ZoneType],
      } : item)));
      toast.success('Zone créée.');
    } catch (error) {
      setZones((current) => current.filter((item) => item.id !== tempId));
      showRetryToast(error instanceof Error ? error.message : 'Impossible de créer la zone.', () => persistZoneCreate(zone, tempId));
    }
  }, []);

  const persistZoneUpdate = useCallback(async (nextZones: IGeofenceZone[], previousZones: IGeofenceZone[]) => {
    setZones(nextZones);

    try {
      await Promise.all(nextZones.map((zone) => geofenceService.updateZone(zone.id, zone)));
      toast.success('Zone mise à jour.');
    } catch (error) {
      setZones(previousZones);
      showRetryToast(error instanceof Error ? error.message : 'Impossible de mettre à jour la zone.', () => persistZoneUpdate(nextZones, previousZones));
    }
  }, []);

  const persistZoneDelete = useCallback(async (zoneIds: number[], previousZones: IGeofenceZone[]) => {
    setZones((current) => current.filter((zone) => !zoneIds.includes(zone.id)));

    try {
      await Promise.all(zoneIds.map((id) => geofenceService.deleteZone(id)));
      toast.success('Zone supprimée.');
    } catch (error) {
      setZones(previousZones);
      showRetryToast(error instanceof Error ? error.message : 'Impossible de supprimer la zone.', () => persistZoneDelete(zoneIds, previousZones));
    }
  }, []);

  const handleZoneCreated = useCallback(async (zone: IGeofenceZone) => {
    const tempId = Number(zone.id || Date.now());
    const optimisticZone: IGeofenceZone = {
      ...zone,
      id: tempId,
      name: zone.name || 'Nouvelle zone',
      type: zone.type || 'exclusion',
      color: zone.color || ZONE_COLORS[(zone.type || 'exclusion') as ZoneType],
    };

    setZones((current) => [...current, optimisticZone]);
    await persistZoneCreate(optimisticZone, tempId);
  }, [persistZoneCreate]);

  const handleZoneEdited = useCallback(async (updatedZones: IGeofenceZone[]) => {
    const previousZones = zones;
    const normalizedZones = updatedZones.map((zone) => ({
      ...zone,
      type: zone.type || 'safe',
      color: zone.color || ZONE_COLORS[(zone.type || 'safe') as ZoneType],
    }));

    await persistZoneUpdate(normalizedZones, previousZones);
  }, [persistZoneUpdate, zones]);

  const handleZoneDeleted = useCallback(async (ids: number[]) => {
    const previousZones = zones;
    await persistZoneDelete(ids, previousZones);
  }, [persistZoneDelete, zones]);

  const handleZoneRename = useCallback(async (zone: IGeofenceZone, nextName: string) => {
    const previousZones = zones;
    const normalizedZones = zones.map((item) => (item.id === zone.id ? { ...item, name: nextName } : item));
    setZones(normalizedZones);

    try {
      await geofenceService.updateZone(zone.id, { ...zone, name: nextName });
      toast.success('Nom de zone mis à jour.');
    } catch (error) {
      setZones(previousZones);
      showRetryToast(error instanceof Error ? error.message : 'Impossible de renommer la zone.', () => handleZoneRename(zone, nextName));
    }
  }, [zones]);

  const handleZoneDeleteConfirm = useCallback((zone: IGeofenceZone & { animalCount?: number }) => {
    const animalCount = zone.animalCount ?? 0;
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer "${zone.name}" ? ${animalCount} animal${animalCount > 1 ? 'aux' : ''} sont actuellement dans cette zone.`);

    if (!confirmed) {
      return;
    }

    void handleZoneDeleted([zone.id]);
  }, [handleZoneDeleted]);

  const handleViewportChange = useCallback((zoom: number, bounds: any) => {
    setViewport({ zoom, bounds });
  }, []);

  const reinitMap = useCallback(() => {
    setMapRetryToken((current) => current + 1);
  }, []);

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col xl:h-[calc(100vh-6rem)] xl:flex-row gap-4 animate-fade-in overflow-y-auto xl:overflow-hidden">
      <div className={`order-1 xl:order-2 min-h-[520px] flex-1 min-w-0 relative transition-[height] duration-300 ease-in-out ${focusMap ? 'h-[92vh] xl:h-[calc(100vh-3rem)]' : 'h-[85vh] xl:h-[calc(100vh-6rem)]'}`}>
        <MapErrorBoundary onRetry={reinitMap}>
          <React.Suspense
            fallback={(
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm text-gray-500 dark:border-gray-800 dark:bg-card-dark dark:text-gray-300">
                Chargement de la carte...
              </div>
            )}
          >
            <ProfilingWrapper>
              <button
                aria-label={focusMap ? 'Exit full map' : 'Focus map'}
                onClick={() => {
                  const next = !focusMap;
                  setFocusMap(next);
                  try { localStorage.setItem('mapFocus', next ? '1' : '0'); } catch { }
                  window.dispatchEvent(new CustomEvent('mapFocusToggled', { detail: next }));
                }}
                className="absolute z-30 right-4 top-4 bg-white/90 dark:bg-black/70 hover:bg-white dark:hover:bg-black shadow-md rounded-full p-2 flex items-center gap-2 border border-gray-200 dark:border-gray-800 transition-all duration-300"
              >
                {focusMap ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span className="hidden sm:inline text-xs font-medium pl-1">{focusMap ? 'Exit' : 'Focus'}</span>
              </button>
              {/* Map - Worker powered */}
              <LazyRealTimeMap
                key={mapRetryToken}
                animalsList={animalsList}
                history={history}
                zones={zones}
                selectedAnimalId={selectedAnimalId}
                onSelectAnimal={handleSelectAnimal}
                onZoneCreated={handleZoneCreated}
                onZoneEdited={handleZoneEdited}
                onZoneDeleted={handleZoneDeleted}
                isSimulation={isSimulation}
                isConnected={isConnected}
                onViewportChange={handleViewportChange}
              />
            </ProfilingWrapper>
          </React.Suspense>
        </MapErrorBoundary>
      </div>

      {!focusMap && (
        <>
          {/* Left Sidebar - Virtualized */}
          <div className="order-2 xl:order-1 w-full xl:max-w-[260px] xl:w-[260px] transition-all duration-300 ease-in-out">
            <MapSidebar
              animalList={animalsList}
              kpis={kpis}
              selectedAnimalId={selectedAnimalId}
              onSelectAnimal={handleSelectAnimal}
              isLoading={false}
            />
          </div>

          <div className="order-3 xl:order-3 w-full xl:max-w-[360px] xl:w-[360px] transition-all duration-300 ease-in-out">
            <GeofencePanel
              zones={zoneSummaries}
              onRenameZone={handleZoneRename}
              onDeleteZone={handleZoneDeleteConfirm}
            />
          </div>
        </>
      )}
    </div>
  );
}
