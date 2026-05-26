import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
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
import { useFarmConfig } from '../../hooks/useFarmConfig';
import { IAnimal, IGeofenceZone } from '../../types';
import { getCurrentWeather, getWeatherAlerts } from '../../services/weatherService';
import { Cloud, Sun, CloudRain, Thermometer, Wind, Filter, Activity, Layers, ArrowRightToLine, ArrowLeftToLine } from 'lucide-react';
import Button from '../../components/ui/Button';

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

const createCustomClusterIcon = (cluster: ClusterMarker) => {
  const childMarkers = cluster.getAllChildMarkers();
  let status: 'CRITICAL' | 'WARNING' | 'SAFE' = 'SAFE';

  for (const marker of childMarkers) {
    const markerStatus = marker.options.icon.options.status;
    if (markerStatus === 'CRITICAL') {
      status = 'CRITICAL';
      break;
    }
    if (markerStatus === 'OUT_OF_ZONE' || markerStatus === 'LOW_BATTERY') {
      status = 'WARNING';
    }
  }

  const color = {
    CRITICAL: '#ef4444',
    WARNING: '#f59e0b',
    SAFE: '#16a34a',
  }[status];

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
             ${childMarkers.length}
           </div>`,
    className: 'custom-cluster-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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
}: RealTimeMapProps) => {
  const { theme } = useTheme();
  const mapRef = React.useRef<any>(null);
  const farmConfig = useFarmConfig();
  const [activeLayer, setActiveLayer] = useState(theme === 'dark' ? 'dark' : 'street');
  const [tileUrl, setTileUrl] = useState(TILE_LAYERS[theme === 'dark' ? 'dark' : 'street'].url);
  const [showWeather, setShowWeather] = useState(false);
  const [weatherType, setWeatherType] = useState('precipitation_new');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherAlerts, setWeatherAlerts] = useState<WeatherAlert[]>([]);

  // Floating Controls State
  const [showTrails, setShowTrails] = useState(false);
  const [heatmapDensity, setHeatmapDensity] = useState(0); // 0 means off
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({ SAFE: true, OUT_OF_ZONE: true, LOW_BATTERY: true, CRITICAL: true });
  const [showControls, setShowControls] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(14);

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

  const visibleAnimals = useMemo(() => {
    console.log('[Map] rendering', processedAnimals.length, 'markers');
    return processedAnimals;
  }, [processedAnimals]);

  const filteredAllAnimals = useMemo(() => visibleAnimals.filter((animal) => activeFilters[animal.status]), [activeFilters, visibleAnimals]);

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
        {...({ whenCreated: (m: any) => { mapRef.current = m } } as any)}
        style={{ height: '100%', minHeight: '400px', width: '100%', position: 'relative' }}
      >
        <MapViewSync animalBounds={animalBounds} initialCenter={initialCenter} />
        <InvalidateMapSize />
        <GeomanControls onZoneCreated={onZoneCreated} onZoneEdited={onZoneEdited} onZoneDeleted={onZoneDeleted} />
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

        {/* Heatmap Layer (respects active filters) */}
        {heatmapDensity > 0 && (
          <HeatmapLayer
            points={filteredAllAnimals
              .filter(a => typeof a.lat === 'number' && typeof a.lng === 'number')
              .map(a => [a.lat as number, a.lng as number, 1] as [number, number, number])}
            options={{ radius: heatmapDensity, blur: heatmapDensity * 1.5, maxZoom: 17 }}
          />
        )}

        {/* Time-Gradient Trails (Optimized: only for selected or limited set) */}
        {showTrails && Object.entries(history).map(([id, path]) => {
          if (!path || path.length < 2) return null;
          // Performance optimization: only show trail for selected animal OR show limited trail for others
          if (selectedAnimalId && id !== selectedAnimalId) return null;

          // Respect active filters: do not render trails for animals filtered out
          const animalMeta = processedAnimals.find(a => String(a.id) === String(id));
          if (animalMeta && !activeFilters[animalMeta.status]) return null;

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

        {/* Marker Clustering Group */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createCustomClusterIcon}
          showCoverageOnHover={false}
          maxClusterRadius={60}
          disableClusteringAtZoom={14}
          spiderfyOnMaxZoom={true}
          // Handle cluster click to show popup with members
          eventHandlers={{
            clusterclick: (ev: any) => {
              try {
                const cluster = ev.layer;
                const childMarkers = cluster.getAllChildMarkers();
                const items = childMarkers.map((m: any) => {
                  const data = m?.options?.icon?.options?.animal || {};
                  return `<div class="py-1 border-b last:border-b-0"><div class="flex items-center justify-between"><div><strong>${(data.name) || data.collar_id || 'N/A'}</strong><div class="text-[11px] text-gray-500">${data.collar_id || ''}</div></div><div class="text-right"><span class="text-[11px] px-2 py-0.5 rounded ${data.status === 'CRITICAL' ? 'bg-red-500 text-white' : data.status === 'OUT_OF_ZONE' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}">${(data.status || '').toLowerCase()}</span><div class="text-[11px] mt-1">${data.battery ?? '--'}%</div></div></div></div>`;
                }).join('');
                const popup = L.popup({ maxWidth: 320 }).setLatLng(cluster.getLatLng()).setContent(`<div class="p-2">${items}<div class="mt-2 text-right"><a href="#" onclick="return false;" class="text-sm text-primary">Voir profils</a></div></div>`);
                popup.openOn(cluster._map || mapRef.current!);
              } catch (e) {
                // noop
              }
            }
          }}
        >
          {filteredAllAnimals.map((animal) => (
            <AnimalMarker
              key={animal.id}
              animal={animal}
              isSelected={selectedAnimalId === animal.id}
              onSelect={onSelectAnimal}
            />
          ))}
        </MarkerClusterGroup>

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
        />
      </MapContainer>

      {/* Weather Toggle Button */}
      <Button
        onClick={() => setShowWeather(!showWeather)}
        variant={showWeather ? 'primary' : 'secondary'}
        className={`absolute top-4 right-4 z-[1000] flex items-center gap-2 rounded-[10px] px-4 py-2 text-[12px] transition-colors ${showWeather
          ? 'border border-[var(--brand-primary)] bg-[var(--brand-light)] text-[var(--brand-dark)]'
          : 'border border-[var(--card-border)] bg-white text-[var(--text-secondary)] hover:border-[#c8dfd6] hover:text-[var(--text-primary)] dark:bg-[var(--card-bg)]'
          }`}
      >
        {showWeather ? <Cloud className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        {showWeather ? 'Météo ON' : 'Météo'}
      </Button>

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

      {/* Floating Control Panel */}
      <div className={`absolute bottom-6 left-6 z-[1000] w-72 rounded-[10px] border border-[var(--card-border)] bg-white/95 p-5 backdrop-blur-md transition-all duration-500 ease-out dark:bg-[var(--card-bg)]/95 ${showControls ? 'translate-x-0 opacity-100 scale-100' : '-translate-x-[120%] opacity-0 scale-95'}`}>
        <Button
          onClick={() => setShowControls(!showControls)}
          variant="ghost"
          size="sm"
          className="absolute -right-12 top-1/2 -translate-y-1/2 border border-[var(--card-border)] bg-white/90 p-3 text-[var(--text-secondary)] backdrop-blur-xl hover:border-[#c8dfd6] hover:text-[var(--brand-primary)] dark:bg-[var(--card-bg)]/90"
        >
          {showControls ? <ArrowLeftToLine size={20} /> : <ArrowRightToLine size={20} />}
        </Button>

        <div className="mb-6 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">
            <Layers size={14} className="text-[var(--brand-primary)]" /> Configuration
          </h4>
          <span className="rounded-full border border-[var(--card-border)] bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-dark)]">V2.4</span>
        </div>

        <div className="space-y-6">
          {/* Trail Toggle */}
          <div className="flex items-center justify-between rounded-[10px] border border-[var(--card-border)] bg-[#fafaf8] p-3 dark:bg-white/3">
            <span className="text-[11px] font-medium text-[var(--text-primary)]">Tracer chemins (30m)</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={showTrails} onChange={e => setShowTrails(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Heatmap Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)]"><Activity size={12} /> Densité Heatmap</p>
              <span className="text-[11px] text-[var(--brand-primary)]">{heatmapDensity > 0 ? `${heatmapDensity}%` : 'OFF'}</span>
            </div>
            <div className="relative group px-1">
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={heatmapDensity}
                onChange={e => setHeatmapDensity(parseInt(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--card-border)] accent-[var(--brand-primary)]"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-primary)]"><Filter size={12} /> Filtres état</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(activeFilters).map(status => {
                const colors: Record<string, string> = {
                  SAFE: 'rgba(34, 197, 94, 0.1)',
                  LOW_BATTERY: 'rgba(245, 158, 11, 0.1)',
                  OUT_OF_ZONE: 'rgba(245, 158, 11, 0.1)',
                  CRITICAL: 'rgba(239, 68, 68, 0.1)'
                };
                const textColors: Record<string, string> = {
                  SAFE: '#22c55e',
                  LOW_BATTERY: '#f59e0b',
                  OUT_OF_ZONE: '#f59e0b',
                  CRITICAL: '#ef4444'
                };
                const dotColors: Record<string, string> = {
                  SAFE: 'bg-green-500',
                  LOW_BATTERY: 'bg-amber-500',
                  OUT_OF_ZONE: 'bg-orange-500',
                  CRITICAL: 'bg-red-500'
                };
                return (
                  <Button
                    key={status}
                    onClick={() => setActiveFilters(prev => ({ ...prev, [status]: !prev[status] }))}
                    variant={activeFilters[status] ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`flex items-center justify-center gap-1.5 rounded-[8px] border px-3 py-2 text-[11px] transition-colors ${activeFilters[status]
                      ? 'border-[var(--card-border)]'
                      : 'border-[var(--card-border)] bg-[#fafaf8] text-[var(--text-muted)] opacity-70'
                      }`}
                    style={activeFilters[status] ? {
                      backgroundColor: colors[status],
                      color: textColors[status]
                    } : {}}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeFilters[status] ? dotColors[status] : 'bg-gray-400'}`} />
                    {status === 'SAFE' ? 'Sauf' : status.replace('_', ' ').toLowerCase()}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[var(--card-border)] pt-6">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 w-6 overflow-hidden rounded-full border-2 border-white bg-gray-100 dark:border-gray-900 dark:bg-gray-800">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="user" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">3 membres en ligne</p>
        </div>
      </div>
    </div>
  );
});

RealTimeMap.displayName = 'RealTimeMap';

export default RealTimeMap;
