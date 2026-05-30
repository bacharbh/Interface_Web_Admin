import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useSearchParams } from 'react-router-dom';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet.heat';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import AnimalMarker from './AnimalMarker';
import GhostMarker from './GhostMarker';
import GeofenceLayer from './GeofenceLayer';
import MapControls, { TILE_LAYERS } from './MapControls';
import UserLocationMarker from '../../components/UserLocationMarker';
import { useTheme } from '../../contexts/ThemeContext';
import { useMqtt } from '../../contexts/MqttContext';
import { useFarmConfig } from '../../hooks/useFarmConfig';
import { IAnimal, IGeofenceZone } from '../../types';
import { getCurrentWeather, getWeatherAlerts } from '../../services/weatherService';
import { Cloud, Sun, CloudRain, Thermometer, Wind, Activity, Layers, ArrowRightToLine, ArrowLeftToLine, Sparkles, AlertTriangle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { applySimulationScenario, getSimulationSettings, resetSimulation, updateSimulationConfig, type AlertGenerationRate, type GroupBehavior, type SimulationScenario, type SimulationSpeed, type SpawnDensity } from '../../utils/simulation';

interface AnimalPosition extends Pick<IAnimal, 'collar_id' | 'name' | 'lat' | 'lng' | 'battery' | 'health' | 'status' | 'speed' | 'temperature' | 'heading' | 'breed' | 'lastUpdate' | 'heartRate' | 'rssi' | 'activity_level' | 'sector' | 'activity'> {
  id: string;
  accuracy: number;
  timestamp: Date;
  status: IAnimal['status'];
  health: IAnimal['health'];
}

interface HeatmapOptions {
  radius: number;
  blur: number;
  maxZoom: number;
}

interface ViewBounds {
  getNorthWest: () => { lat: number; lng: number };
  getSouthEast: () => { lat: number; lng: number };
}

interface ClusterMarker {
  getAllChildMarkers: () => Array<{ options: { icon: { options: { status?: string; animal?: { name?: string; collar_id?: string; battery?: number; status?: string } } } } }>;
}

interface WeatherData {
  current: { temp: number; humidity: number; windSpeed: number };
  weather: { main: string; description: string };
}

interface WeatherAlert {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  recommendation: string;
}

interface RealTimeMapProps {
  animalsList: IAnimal[];
  clusters?: Array<{ id?: string; status: string } | null | undefined>;
  finalAnimals?: IAnimal[];
  history: Record<string, Array<{ lat?: number; lng?: number }>>;
  zones: IGeofenceZone[];
  selectedAnimalId: string | null;
  onSelectAnimal: (id: string | null) => void;
  onZoneCreated: (zone: IGeofenceZone) => void;
  onZoneEdited: (zones: IGeofenceZone[]) => void;
  onZoneDeleted: (ids: number[]) => void;
  isSimulation: boolean;
  isConnected: boolean;
  onViewportChange: (zoom: number, bounds: ViewBounds) => void;
  center?: [number, number];
  tileLayerOverride?: 'streets' | 'satellite' | 'dark';
  imperativeRef?: React.MutableRefObject<((lat: number, lng: number, zoom?: number) => void) | null>;
}

// Fix Leaflet default marker icons for Vite/Webpack bundling.
delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});
const HeatmapLayer = ({ points, options }: { points: [number, number, number][], options: HeatmapOptions }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heat = (L as typeof L & { heatLayer: (input: [number, number, number][], config: HeatmapOptions) => L.Layer }).heatLayer(points, options).addTo(map);
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, options]);
  return null;
};

const InvalidateMapSize = () => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (e) {
        // ignore
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
};

type GeomanMap = L.Map & {
  pm?: {
    addControls: (options: {
      position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
      drawPolygon?: boolean;
      editMode?: boolean;
      dragMode?: boolean;
      cutPolygon?: boolean;
      drawMarker?: boolean;
      drawCircle?: boolean;
      drawRectangle?: boolean;
      drawPolyline?: boolean;
      disableDraw?: () => void;
      enableDraw?: (shape: string, options?: Record<string, unknown>) => void;
      enableGlobalRemovalMode?: () => void;
      disableGlobalRemovalMode?: () => void;
    }) => void;
  };
};

const GeomanControls = ({
  onZoneCreated,
  onZoneEdited,
  onZoneDeleted,
}: {
  onZoneCreated: (zone: IGeofenceZone) => void;
  onZoneEdited: (zones: IGeofenceZone[]) => void;
  onZoneDeleted: (ids: number[]) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const mapInst = map as GeomanMap;
    if (!mapInst.pm) return;

    try {
      mapInst.pm.addControls({
        position: 'topright',
        drawPolygon: true,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        drawMarker: false,
        drawCircle: false,
        drawRectangle: false,
        drawPolyline: false,
      });
    } catch {
      return;
    }

    const extractCoords = (layer: L.Layer): [number, number][] | null => {
      const toGeoJSON = (layer as L.Layer & { toGeoJSON: () => GeoJSON.Feature }).toGeoJSON;
      if (!toGeoJSON) return null;
      const geo = toGeoJSON();
      const coordinates = (geo.geometry as GeoJSON.Polygon | undefined)?.coordinates?.[0];
      if (!Array.isArray(coordinates) || coordinates.length < 3) return null;
      return coordinates.map(([lng, lat]) => [lat, lng]);
    };

    const onCreate = (event: { layer: L.Layer }) => {
      const coords = extractCoords(event.layer);
      if (!coords) {
        event.layer.remove();
        return;
      }

      onZoneCreated({
        id: Date.now(),
        name: 'Nouvelle zone',
        coords,
        color: '#f59e0b',
        type: 'exclusion',
      });
    };

    const onEdit = (event: { layers: { eachLayer: (callback: (layer: L.Layer) => void) => void } }) => {
      const nextZones: IGeofenceZone[] = [];

      event.layers.eachLayer((layer) => {
        const coords = extractCoords(layer);
        if (!coords) return;

        const zoneId = Number((layer as L.Layer & { options?: { id?: number } }).options?.id);
        if (!zoneId) return;

        nextZones.push({
          id: zoneId,
          name: 'Zone',
          coords,
          color: '#f59e0b',
          type: 'exclusion',
        });
      });

      if (nextZones.length > 0) {
        onZoneEdited(nextZones);
      }
    };

    const onRemove = (event: { layers: { eachLayer: (callback: (layer: L.Layer) => void) => void } }) => {
      const removedIds: number[] = [];

      event.layers.eachLayer((layer) => {
        const zoneId = Number((layer as L.Layer & { options?: { id?: number } }).options?.id);
        if (zoneId) removedIds.push(zoneId);
      });

      if (removedIds.length > 0) {
        onZoneDeleted(removedIds);
      }
    };

    mapInst.on('pm:create' as any, onCreate as any);
    mapInst.on('pm:edit' as any, onEdit as any);
    mapInst.on('pm:remove' as any, onRemove as any);

    return () => {
      mapInst.off('pm:create' as any, onCreate as any);
      mapInst.off('pm:edit' as any, onEdit as any);
      mapInst.off('pm:remove' as any, onRemove as any);
    };
  }, [map, onZoneCreated, onZoneEdited, onZoneDeleted]);

  return null;
};

const MapViewSync = ({
  animalBounds,
  initialCenter,
}: {
  animalBounds: L.LatLngBounds | null;
  initialCenter: [number, number];
}) => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (animalBounds && animalBounds.isValid()) {
        map.fitBounds(animalBounds, { padding: [40, 40] });
      } else {
        map.setView(initialCenter, 14);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [animalBounds, initialCenter, map]);

  return null;
};

const MapEvents = ({ onViewportChange, onZoomChange }: { onViewportChange: (zoom: number, bounds: ViewBounds) => void; onZoomChange: (zoom: number) => void }) => {
  const map = useMap();

  useEffect(() => {
    const handleMove = () => {
      onViewportChange(map.getZoom(), map.getBounds());
      onZoomChange(map.getZoom());
    };

    map.on('moveend', handleMove);
    map.on('zoomend', handleMove);
    handleMove();

    return () => {
      map.off('moveend', handleMove);
      map.off('zoomend', handleMove);
    };
  }, [map, onViewportChange, onZoomChange]);

  return null;
};

const MapImperativeRef = ({ imperativeRef }: { imperativeRef?: React.MutableRefObject<((lat: number, lng: number, zoom?: number) => void) | null> }) => {
  const map = useMap();

  useEffect(() => {
    if (!imperativeRef) return;
    imperativeRef.current = (lat: number, lng: number, zoom = 16) => {
      map.setView([lat, lng], zoom, { animate: true });
    };

    return () => {
      imperativeRef.current = null;
    };
  }, [map, imperativeRef]);

  return null;
};

const createCustomClusterIcon = (cluster: ClusterMarker) => {
  const childMarkers = cluster.getAllChildMarkers();
  const counts = childMarkers.reduce((acc, marker) => {
    const markerStatus = marker.options.icon.options.status ?? 'SAFE';
    acc[markerStatus] = (acc[markerStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const status = counts.CRITICAL > 0
    ? 'CRITICAL'
    : ((counts.OUT_OF_ZONE || 0) + (counts.LOW_BATTERY || 0)) >= (counts.SAFE || 0)
      ? 'WARNING'
      : 'SAFE';

  const color = {
    CRITICAL: '#ef4444',
    WARNING: '#f59e0b',
    SAFE: '#16a34a',
  }[status];

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 15px; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 4px 15px ${color}80, inset 0 0 10px rgba(255,255,255,0.4); backdrop-filter: blur(4px); position: relative;">
             <span style="position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: white; border-radius: 50%; display: inline-block;"></span>
             ${childMarkers.length}
           </div>`,
    className: 'custom-cluster-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getStableGhostPosition = (animal: IAnimal, center: [number, number]) => {
  const seed = `${animal.collar_id}-${animal.lastUpdate ?? ''}-${animal.lat ?? ''}-${animal.lng ?? ''}`;
  const hash = hashString(seed);
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.0002 + ((hash % 17) / 100000);
  const baseLat = typeof animal.lat === 'number' ? animal.lat : center[0];
  const baseLng = typeof animal.lng === 'number' ? animal.lng : center[1];

  return {
    lat: baseLat + Math.sin(angle) * radius,
    lng: baseLng + Math.cos(angle) * radius,
  };
};

const RealTimeMap = React.memo(({
  animalsList,
  clusters = [],
  finalAnimals = [],
  history,
  zones,
  selectedAnimalId,
  onSelectAnimal,
  onZoneCreated,
  onZoneEdited,
  onZoneDeleted,
  isSimulation,
  isConnected,
  onViewportChange,
  tileLayerOverride,
  imperativeRef,
}: RealTimeMapProps) => {
  const { theme } = useTheme();
  const { toggleSimulation } = useMqtt();
  const mapRef = React.useRef<any>(null);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const farmConfig = useFarmConfig();
  const [simulationSettings, setSimulationSettings] = useState(() => getSimulationSettings());
  const [activeLayer, setActiveLayer] = useState<keyof typeof TILE_LAYERS>(theme === 'dark' ? 'dark' : 'street');
  const [tileUrl, setTileUrl] = useState(TILE_LAYERS[theme === 'dark' ? 'dark' : 'street'].url);
  const [showWeather, setShowWeather] = useState(false);
  const [weatherType, setWeatherType] = useState('precipitation_new');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);

  // Floating Controls State
  const [showTrails, setShowTrails] = useState(false);
  const [heatmapDensity, setHeatmapDensity] = useState(0); // 0 means off
  const [displayMode, setDisplayMode] = useState<'markers' | 'heatmap'>('markers');
  const [showControls, setShowControls] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(14);

  useEffect(() => {
    updateSimulationConfig(simulationSettings);
  }, [simulationSettings]);

  useEffect(() => {
    if (!tileLayerOverride) return;
    const map: Record<'streets' | 'satellite' | 'dark', keyof typeof TILE_LAYERS> = {
      streets: 'street',
      satellite: 'satellite',
      dark: 'dark',
    };
    const key = map[tileLayerOverride] || 'street';
    if (TILE_LAYERS[key]?.url) setTileUrl(TILE_LAYERS[key].url);
    if (key !== activeLayer) setActiveLayer(key);
  }, [activeLayer, tileLayerOverride]);

  const processedAnimals = useMemo<AnimalPosition[]>(() => {
    return animalsList
      .filter((animal) => typeof animal.lat === 'number' && typeof animal.lng === 'number')
      .map((animal) => ({
        ...animal,
        id: animal.collar_id,
        accuracy: typeof animal.rssi === 'number' ? Math.max(5, 100 - Math.abs(animal.rssi)) : 25,
        timestamp: animal.lastUpdate ? new Date(animal.lastUpdate) : new Date(),
        status: animal.status,
        health: animal.health,
      }));
  }, [animalsList]);

  const activeAnimalCount = processedAnimals.length;
  const autoRenderMode = useMemo(() => {
    if (!simulationSettings.autoClusteringEnabled) {
      return currentZoom < 12 ? 'cluster' : currentZoom < 15 ? 'simple' : 'detailed';
    }

    if (activeAnimalCount > 300 || simulationSettings.animalCount > 300) return 'heatmap';
    if (activeAnimalCount > 150 || simulationSettings.animalCount > 150) return 'cluster';
    if (activeAnimalCount > 50 || simulationSettings.animalCount > 50) return 'cluster';
    return currentZoom < 15 ? 'simple' : 'detailed';
  }, [activeAnimalCount, currentZoom, simulationSettings.animalCount, simulationSettings.autoClusteringEnabled]);

  const effectiveDisplayMode = displayMode === 'heatmap' || autoRenderMode === 'heatmap' ? 'heatmap' : 'markers';
  const renderMode = effectiveDisplayMode === 'markers' ? autoRenderMode : 'heatmap';

  // derive positions/bounds
  const animalPositions = useMemo(() => processedAnimals.map((a) => [a.lat, a.lng] as [number, number]).filter((position) => Number.isFinite(position[0]) && Number.isFinite(position[1])), [processedAnimals]);
  const animalBounds = useMemo(() => {
    if (!animalPositions || animalPositions.length === 0) return null;
    return L.latLngBounds(animalPositions as unknown as L.LatLngExpression[]);
  }, [animalPositions]);

  const farmCenter = useMemo<[number, number] | null>(() => {
    if (farmConfig.farmLat === null || farmConfig.farmLng === null) {
      return null;
    }

    return [farmConfig.farmLat, farmConfig.farmLng];
  }, [farmConfig.farmLat, farmConfig.farmLng]);

  const initialCenter = useMemo<[number, number] | null>(() => {
    if (animalPositions.length > 0) {
      const total = animalPositions.reduce((acc, [lat, lng]) => {
        acc.lat += lat;
        acc.lng += lng;
        return acc;
      }, { lat: 0, lng: 0 });

      return [total.lat / animalPositions.length, total.lng / animalPositions.length];
    }

    // Fallback: farm center or a default near Europe (FR)
    if (farmCenter) return farmCenter;
    return [46.2276, 2.2137];
  }, [animalPositions, farmCenter]);

  const stableGhostAnimals = useMemo(() => {
    const anchor = farmCenter ?? initialCenter;

    if (!anchor) {
      return [];
    }

    return animalsList
      .filter((animal) => {
        const lastSeen = new Date((animal as IAnimal & { last_heartbeat?: string }).last_heartbeat || animal.lastUpdate || 0).getTime();
        const staleTime = Date.now() - lastSeen;
        return staleTime > 120000 && staleTime < 600000;
      })
      .map((animal) => {
        const lastSeen = new Date((animal as IAnimal & { last_heartbeat?: string }).last_heartbeat || animal.lastUpdate || 0).getTime();
        const staleTime = Date.now() - lastSeen;
        return {
          animal,
          staleTime,
          lastSeen,
          predictedPos: getStableGhostPosition(animal, anchor),
        };
      });
  }, [animalsList, farmCenter, initialCenter]);



  // Listen for focus toggles to reflow Leaflet size
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        if (mapRef.current) {
          try { mapRef.current.invalidateSize(); } catch (e) { /* ignore */ }
        }
      }, 80);
    };

    window.addEventListener('mapFocusToggled', handler as EventListener);
    return () => window.removeEventListener('mapFocusToggled', handler as EventListener);
  }, []);

  const WEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_KEY || '';

  useEffect(() => {
    const weatherCenter = farmCenter ?? initialCenter;

    if (showWeather && weatherCenter) {
      const fetchWeather = async () => {
        try {
          const [current, alerts] = await Promise.all([
            getCurrentWeather(weatherCenter[0], weatherCenter[1]),
            getWeatherAlerts(weatherCenter[0], weatherCenter[1])
          ]);
          setWeatherData(current);
          setWeatherAlerts(alerts.alerts);
        } catch (error) {
          console.error('Erreur récupération météo:', error);
        }
      };
      fetchWeather();
    }
  }, [showWeather, farmCenter, initialCenter]);

  const breachedZoneIds = useMemo(() => {
    if (!Array.isArray(animalsList) || !Array.isArray(zones)) {
      return [];
    }
    const hasOutOfZone = animalsList.some((animal) => animal && (animal.health === 'Critical' || animal.status === 'OUT_OF_ZONE'));
    return hasOutOfZone ? zones.filter((zone) => Boolean(zone?.id)).map((zone) => zone.id) : [];
  }, [animalsList, zones]);

  const tileConfig = TILE_LAYERS[activeLayer as keyof typeof TILE_LAYERS] || TILE_LAYERS.street;

  useEffect(() => {
    setTileUrl(tileConfig.url);
  }, [tileConfig.url, activeLayer]);

  const handleToggleWeather = () => {
    setShowWeather((current) => !current);
  };

  const handleToggleSimulation = () => {
    toggleSimulation();
  };

  const handleStartPolygonDraw = () => {
    const map = mapRef.current as GeomanMap | null;
    if (!map?.pm) return;

    map.pm.disableGlobalRemovalMode?.();
    map.pm.enableDraw?.('Polygon', {
      snappable: true,
      snapDistance: 18,
      allowSelfIntersection: false,
      pathOptions: {
        color: '#16a34a',
        weight: 3,
        fillColor: '#16a34a',
        fillOpacity: 0.18,
      },
    });
  };

  const handleDeleteMode = () => {
    const map = mapRef.current as GeomanMap | null;
    if (!map?.pm) return;

    map.pm.disableDraw?.();
    map.pm.enableGlobalRemovalMode?.();
  };

  const handleCancelGeomanMode = () => {
    const map = mapRef.current as GeomanMap | null;
    if (!map?.pm) return;

    map.pm.disableDraw?.();
    map.pm.disableGlobalRemovalMode?.();
  };

  const visibleAnimals = useMemo(() => {
    console.log('[Map] rendering', processedAnimals.length, 'markers');
    return processedAnimals;
  }, [processedAnimals]);

  useEffect(() => {
    if (!focusId || !mapRef.current) return;

    const target = Object.values(animalsList).find(
      (animal: any) => animal.collar_id === focusId || animal.id === focusId || animal.sheepId === focusId
    );

    if (target && typeof target.lat === 'number' && typeof target.lng === 'number') {
      try {
        mapRef.current.setView([target.lat, target.lng], 18);
      } catch (error) {
        console.warn('Unable to focus map on selected animal:', error);
      }
    }
  }, [animalsList, focusId]);

  if (!initialCenter) {
    return (
      <div className="relative h-full min-h-[520px] overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)]">
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/80 p-6 dark:bg-black/60">
          <div className="max-w-md text-center">
            <h3 className="mb-2 text-[16px] font-medium text-[var(--text-primary)]">La carte nécessite la position de la ferme</h3>
            <p className="mb-4 text-[13px] text-[var(--text-secondary)]">Aucun animal positionné et aucune coordonnée de ferme n’est configurée.</p>
            <Button variant="primary" onClick={() => {
              const lat = prompt('Latitude de la ferme (ex: 36.8)');
              const lng = prompt('Longitude de la ferme (ex: 10.2)');
              if (lat && lng) {
                try {
                  const cfg = { farmLat: Number(lat), farmLng: Number(lng), farmName: 'Ferme' };
                  localStorage.setItem('smartShepherdConfig_v2', JSON.stringify(cfg));
                  window.location.reload();
                } catch {
                  // noop
                }
              }
            }}>Configurer la position de la ferme</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 relative h-full min-h-[520px] overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)]">
      <MapContainer
        center={initialCenter}
        zoom={14}
        className="w-full"
        zoomControl={false}
        preferCanvas={true}
        {...({ whenCreated: (m: any) => { mapRef.current = m } } as any)}
        style={{ height: '100%', minHeight: '400px', width: '100%', position: 'relative' }}
      >
        <MapViewSync animalBounds={animalBounds} initialCenter={initialCenter} />
        <InvalidateMapSize />
        <MapImperativeRef imperativeRef={imperativeRef} />
        <MapEvents onViewportChange={onViewportChange} onZoomChange={setCurrentZoom} />

        <TileLayer
          key={activeLayer}
          attribution={tileConfig.attribution}
          url={tileUrl}
          eventHandlers={{
            tileerror: () => {
              if (activeLayer === 'street' && tileConfig.backupUrl && tileUrl !== tileConfig.backupUrl) {
                setTileUrl(tileConfig.backupUrl);
              }
            }
          }}
        />

        <GeofenceLayer
          zones={zones}
          onZoneCreated={onZoneCreated}
          onZoneEdited={onZoneEdited}
          onZoneDeleted={onZoneDeleted}
          breachedZoneIds={breachedZoneIds}
        />

        {/* Heatmap Layer */}
        {effectiveDisplayMode === 'heatmap' && (heatmapDensity > 0 || renderMode === 'heatmap') && (
          <HeatmapLayer
            points={visibleAnimals
              .filter(a => typeof a.lat === 'number' && typeof a.lng === 'number')
              .map(a => [a.lat as number, a.lng as number, 1] as [number, number, number])}
            options={{ radius: heatmapDensity > 0 ? heatmapDensity : 24, blur: (heatmapDensity > 0 ? heatmapDensity : 24) * 1.4, maxZoom: 17 }}
          />
        )}

        {/* Time-Gradient Trails (Optimized: only for selected or limited set) */}
        {showTrails && Object.entries(history).map(([id, path]) => {
          if (!path || path.length < 2) return null;
          // Performance optimization: only show trail for selected animal OR show limited trail for others
          if (selectedAnimalId && id !== selectedAnimalId) return null;

          const recentPath = path.slice(-30);
          return (
            <React.Fragment key={`trail-group-${id}`}>
              {recentPath.map((pt, i) => {
                if (i === 0) return null;
                const prevPt = recentPath[i - 1];
                if (typeof prevPt.lat !== 'number' || typeof prevPt.lng !== 'number' || typeof pt.lat !== 'number' || typeof pt.lng !== 'number') {
                  return null;
                }
                const opacity = 0.2 + (0.8 * (i / recentPath.length));
                return (
                  <Polyline
                    key={`trail-${id}-${i}`}
                    positions={[[prevPt.lat, prevPt.lng], [pt.lat, pt.lng]]}
                    pathOptions={{
                      color: id === selectedAnimalId ? '#3b82f6' : '#94a3b8',
                      weight: id === selectedAnimalId ? 4 : 2,
                      opacity
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {effectiveDisplayMode === 'markers' && renderMode === 'cluster' && (
          <MarkerClusterGroup chunkedLoading maxClusterRadius={50} disableClusteringAtZoom={12} iconCreateFunction={createCustomClusterIcon as any}>
            {visibleAnimals.map((animal) => (
              <AnimalMarker
                key={animal.id}
                animal={animal}
                isSelected={selectedAnimalId === animal.id}
                onSelect={onSelectAnimal}
                variant="simple"
              />
            ))}
          </MarkerClusterGroup>
        )}

        {effectiveDisplayMode === 'markers' && renderMode !== 'cluster' && visibleAnimals.map((animal) => (
          <AnimalMarker
            key={animal.id}
            animal={animal}
            isSelected={selectedAnimalId === animal.id}
            onSelect={onSelectAnimal}
            variant={renderMode === 'simple' ? 'simple' : 'detailed'}
          />
        ))}

        {stableGhostAnimals.map(({ animal, staleTime, predictedPos }) => (
          <GhostMarker
            key={`ghost-${animal.collar_id}`}
            animal={animal}
            predictedPos={predictedPos}
            confidenceRadius={50 + staleTime / 1000}
            lastSeenMin={Math.round(staleTime / 60000)}
          />
        ))}

        {showWeather && WEATHER_API_KEY && weatherType !== 'none' && (
          <TileLayer
            url={`https://tile.openweathermap.org/map/${weatherType}/{z}/{x}/{y}.png?appid=${WEATHER_API_KEY}`}
            opacity={0.5}
          />
        )}

        <UserLocationMarker showAccuracy={true} autoTrack={true} />

        <MapControls
          isSimulation={isSimulation}
          isConnected={isConnected}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          recenterCenter={initialCenter}
          showWeather={showWeather}
          onToggleWeather={handleToggleWeather}
          onToggleSimulation={handleToggleSimulation}
        />
      </MapContainer>

      {/* Weather Alerts Display */}
      {showWeather && weatherAlerts.length > 0 && (
        <div className="absolute top-16 right-4 z-[1000] w-80 space-y-2">
          {weatherAlerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-[10px] border p-3 ${alert.severity === 'CRITICAL'
                ? 'border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]'
                : alert.severity === 'WARNING'
                  ? 'border-[var(--warning)] bg-[var(--warning-bg)] text-[var(--warning)]'
                  : 'border-[var(--brand-primary)] bg-[var(--brand-light)] text-[var(--brand-dark)]'
                }`}
            >
              <div className="flex items-start gap-2">
                {alert.severity === 'CRITICAL' && <Thermometer className="w-5 h-5 flex-shrink-0" />}
                {alert.severity === 'WARNING' && <Wind className="w-5 h-5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-[12px] font-medium">{alert.message}</p>
                  <p className="mt-1 text-[11px] opacity-90">{alert.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Weather Info */}
      {showWeather && weatherData && (
        <div className="absolute bottom-4 left-[300px] z-[1000] rounded-[10px] border border-[var(--card-border)] bg-white p-4 dark:bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            {weatherData.weather.main === 'Rain' && <CloudRain className="w-8 h-8 text-blue-500" />}
            {weatherData.weather.main === 'Clear' && <Sun className="w-8 h-8 text-yellow-500" />}
            {weatherData.weather.main === 'Clouds' && <Cloud className="w-8 h-8 text-gray-500" />}
            <div>
              <p className="text-[24px] font-medium text-[var(--text-primary)]">{weatherData.current.temp}°C</p>
              <p className="text-[12px] text-[var(--text-secondary)]">{weatherData.weather.description}</p>
            </div>
            <div className="ml-4 space-y-1 text-[11px] text-[var(--text-secondary)]">
              <p>💧 {weatherData.current.humidity}%</p>
              <p>💨 {weatherData.current.windSpeed} m/s</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Simulation Panel */}
      <div className={`pointer-events-none absolute bottom-6 left-6 z-[1000] w-[24rem] max-w-[calc(100vw-3rem)] rounded-[20px] border border-[var(--card-border)] bg-white/95 p-4 shadow-2xl shadow-black/10 backdrop-blur-md transition-all duration-500 ease-out dark:bg-[var(--card-bg)]/95 ${showControls ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-[120%] opacity-0 scale-95'}`}>
        <Button
          onClick={() => setShowControls(!showControls)}
          variant="ghost"
          size="sm"
          className="pointer-events-auto absolute -right-12 top-1/2 -translate-y-1/2 border border-[var(--card-border)] bg-white/90 p-3 text-[var(--text-secondary)] backdrop-blur-xl hover:border-[#c8dfd6] hover:text-[var(--brand-primary)] dark:bg-[var(--card-bg)]/90"
        >
          {showControls ? <ArrowLeftToLine size={20} /> : <ArrowRightToLine size={20} />}
        </Button>

        <div className="pointer-events-auto space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <Layers size={14} className="text-[var(--brand-primary)]" /> Simulation GIS
              </h4>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{activeAnimalCount} animaux actifs, mode {effectiveDisplayMode === 'heatmap' ? 'heatmap' : renderMode}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${simulationSettings.autoClusteringEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[var(--card-border)] bg-[var(--bg-secondary)] text-[var(--text-muted)]'}`}>
              {simulationSettings.autoClusteringEnabled ? 'Auto cluster' : 'Manual'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[16px] border border-[var(--card-border)] bg-[#fafaf8] p-2 dark:bg-white/3">
            <button
              onClick={() => setDisplayMode('markers')}
              className={`rounded-[12px] px-3 py-2 text-[11px] font-semibold transition-colors ${displayMode === 'markers' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-white/70 dark:hover:bg-white/5'}`}
            >
              Markers
            </button>
            <button
              onClick={() => {
                setDisplayMode('heatmap');
                if (heatmapDensity === 0) setHeatmapDensity(24);
              }}
              className={`rounded-[12px] px-3 py-2 text-[11px] font-semibold transition-colors ${displayMode === 'heatmap' ? 'bg-primary text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-white/70 dark:hover:bg-white/5'}`}
            >
              Heatmap
            </button>
            <button
              onClick={() => {
                setDisplayMode('markers');
                setHeatmapDensity(0);
              }}
              className="rounded-[12px] px-3 py-2 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-white/70 dark:hover:bg-white/5"
            >
              Auto
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Animal count</span>
                <span className="text-[var(--brand-primary)]">{simulationSettings.animalCount}</span>
              </div>
              <input type="range" min="20" max="400" step="10" value={simulationSettings.animalCount} onChange={(event) => setSimulationSettings((current) => ({ ...current, animalCount: parseInt(event.target.value, 10) }))} className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--card-border)] accent-[var(--brand-primary)]" />
            </label>
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Simulation speed</span>
                <span className="text-[var(--brand-primary)] capitalize">{simulationSettings.simulationSpeed}</span>
              </div>
              <select value={simulationSettings.simulationSpeed} onChange={(event) => setSimulationSettings((current) => ({ ...current, simulationSpeed: event.target.value as SimulationSpeed }))} className="w-full rounded-[10px] border border-[var(--card-border)] bg-white px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none dark:bg-[var(--card-bg)]">
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Spawn density</span>
                <span className="text-[var(--brand-primary)] capitalize">{simulationSettings.spawnDensity}</span>
              </div>
              <select value={simulationSettings.spawnDensity} onChange={(event) => setSimulationSettings((current) => ({ ...current, spawnDensity: event.target.value as SpawnDensity }))} className="w-full rounded-[10px] border border-[var(--card-border)] bg-white px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none dark:bg-[var(--card-bg)]">
                <option value="sparse">Sparse</option>
                <option value="medium">Medium</option>
                <option value="dense">Dense</option>
              </select>
            </label>
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Spawn radius</span>
                <span className="text-[var(--brand-primary)]">{simulationSettings.spawnRadius.toFixed(1)}x</span>
              </div>
              <input type="range" min="0.6" max="3" step="0.2" value={simulationSettings.spawnRadius} onChange={(event) => setSimulationSettings((current) => ({ ...current, spawnRadius: parseFloat(event.target.value) }))} className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--card-border)] accent-[var(--brand-primary)]" />
            </label>
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Group behavior</span>
                <span className="text-[var(--brand-primary)] capitalize">{simulationSettings.groupBehavior}</span>
              </div>
              <select value={simulationSettings.groupBehavior} onChange={(event) => setSimulationSettings((current) => ({ ...current, groupBehavior: event.target.value as GroupBehavior }))} className="w-full rounded-[10px] border border-[var(--card-border)] bg-white px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none dark:bg-[var(--card-bg)]">
                <option value="compact">Compact</option>
                <option value="natural">Natural</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="space-y-2 rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 text-[11px] font-medium text-[var(--text-primary)] dark:bg-white/3">
              <div className="flex items-center justify-between">
                <span>Alert rate</span>
                <span className="text-[var(--brand-primary)] capitalize">{simulationSettings.alertGenerationRate}</span>
              </div>
              <select value={simulationSettings.alertGenerationRate} onChange={(event) => setSimulationSettings((current) => ({ ...current, alertGenerationRate: event.target.value as AlertGenerationRate }))} className="w-full rounded-[10px] border border-[var(--card-border)] bg-white px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none dark:bg-[var(--card-bg)]">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSimulationSettings((current) => ({ ...current, batteryDrainEnabled: !current.batteryDrainEnabled }))} className={`rounded-[12px] border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${simulationSettings.batteryDrainEnabled ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-[var(--card-border)] bg-white text-[var(--text-muted)]'}`}>
              <div className="flex items-center gap-2"><AlertTriangle size={13} /> Battery drain {simulationSettings.batteryDrainEnabled ? 'ON' : 'OFF'}</div>
            </button>
            <button onClick={() => setSimulationSettings((current) => ({ ...current, autoClusteringEnabled: !current.autoClusteringEnabled }))} className={`rounded-[12px] border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${simulationSettings.autoClusteringEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[var(--card-border)] bg-white text-[var(--text-muted)]'}`}>
              <div className="flex items-center gap-2"><Sparkles size={13} /> Auto clustering {simulationSettings.autoClusteringEnabled ? 'ON' : 'OFF'}</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[16px] border border-[var(--card-border)] bg-[#fafaf8] p-2 dark:bg-white/3">
            <button onClick={() => { resetSimulation(); setSimulationSettings((current) => ({ ...current, scenario: 'normal' })); }} className="rounded-[12px] border border-[var(--card-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] dark:bg-[var(--card-bg)]">Generate Scenario</button>
            <button onClick={() => { applySimulationScenario('emergency' as SimulationScenario); setSimulationSettings((current) => ({ ...current, scenario: 'emergency', alertGenerationRate: 'high', groupBehavior: 'compact', spawnDensity: 'dense' })); }} className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 transition-colors hover:border-red-300">Emergency</button>
            <button onClick={() => { applySimulationScenario('lost_sheep' as SimulationScenario); setSimulationSettings((current) => ({ ...current, scenario: 'lost_sheep', groupBehavior: 'random', spawnDensity: 'sparse' })); }} className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 transition-colors hover:border-amber-300">Lost Sheep</button>
            <button onClick={() => { applySimulationScenario('battery_failure' as SimulationScenario); setSimulationSettings((current) => ({ ...current, scenario: 'battery_failure', alertGenerationRate: 'high', batteryDrainEnabled: true })); }} className="rounded-[12px] border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-700 transition-colors hover:border-violet-300">Battery Failure</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleStartPolygonDraw} className="rounded-[12px] border border-[var(--card-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] dark:bg-[var(--card-bg)]">Draw Zone</button>
            <button onClick={handleDeleteMode} className="rounded-[12px] border border-[var(--card-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--danger)] hover:text-[var(--danger)] dark:bg-[var(--card-bg)]">Delete Zone</button>
            <button onClick={handleCancelGeomanMode} className="rounded-[12px] border border-[var(--card-border)] bg-white px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--warning)] hover:text-[var(--warning)] dark:bg-[var(--card-bg)]">Cancel</button>
          </div>

          <div className="flex items-center justify-between rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] px-3 py-2 text-[11px] dark:bg-white/3">
            <span className="font-medium text-[var(--text-primary)]">Tracer chemins</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={showTrails} onChange={(event) => setShowTrails(event.target.checked)} className="sr-only peer" />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-dark:bg-gray-700 peer-dark:after:border-gray-600"></div>
            </label>
          </div>

          <div className="rounded-[14px] border border-[var(--card-border)] bg-[#fafaf8] p-3 dark:bg-white/3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)]"><Activity size={12} /> Heatmap density</p>
              <span className="text-[11px] text-[var(--brand-primary)]">{heatmapDensity > 0 ? `${heatmapDensity}` : 'OFF'}</span>
            </div>
            <input type="range" min="0" max="50" step="5" value={heatmapDensity} onChange={(event) => setHeatmapDensity(parseInt(event.target.value, 10))} className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--card-border)] accent-[var(--brand-primary)]" />
          </div>
        </div>
      </div>
    </div>
  );
});

RealTimeMap.displayName = 'RealTimeMap';

export default RealTimeMap;
