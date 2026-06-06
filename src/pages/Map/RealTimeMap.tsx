import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet.heat';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import AnimalMarker from './AnimalMarker';
import GeofenceLayer from './GeofenceLayer';
import MapControls, { TILE_LAYERS } from './MapControls';
import UserLocationMarker from '../../components/UserLocationMarker';
import { useTheme } from '../../contexts/ThemeContext';
import { useFarmConfig } from '../../hooks/useFarmConfig';
import { IAnimal, IGeofenceZone } from '../../types';
import { getCurrentWeather, getWeatherAlerts } from '../../services/weatherService';
import { Cloud, Sun, CloudRain, Thermometer, Wind, Route, Waves, Radar, Sparkles, PenSquare, Trash2, Ban } from 'lucide-react';
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
  isConnected,
  onViewportChange,
  tileLayerOverride,
  imperativeRef,
}: RealTimeMapProps) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const mapRef = React.useRef<any>(null);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const farmConfig = useFarmConfig();
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
  const [currentZoom, setCurrentZoom] = useState(14);

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
    if (activeAnimalCount > 300) return 'heatmap';
    if (activeAnimalCount > 150) return 'cluster';
    if (activeAnimalCount > 50) return 'cluster';
    return currentZoom < 15 ? 'simple' : 'detailed';
  }, [activeAnimalCount, currentZoom]);

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

    if (farmCenter) return farmCenter;
    return null;
  }, [animalPositions, farmCenter]);

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

  const visibleAnimals = useMemo(() => processedAnimals, [processedAnimals]);

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
      <div className="relative h-full min-h-[520px] overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)] flex items-center justify-center">
        <div className="max-w-md text-center px-6 py-10 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Carte GPS non disponible</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Les colliers IoT ne transmettent pas de coordonnées GPS.<br />
              Configurez la position de la ferme pour afficher un centre de carte.
            </p>
          </div>
          <Button variant="primary" onClick={() => navigate("/settings")}>Configurer la position de la ferme</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 relative h-full min-h-[520px] overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)]">
      <div className="pointer-events-none absolute inset-0 z-[600] bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,0.16),transparent_36%),radial-gradient(circle_at_82%_78%,rgba(14,165,233,0.14),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[610] h-28 bg-gradient-to-b from-black/20 via-black/5 to-transparent" />

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

        {showWeather && WEATHER_API_KEY && weatherType !== 'none' && (
          <TileLayer
            url={`https://tile.openweathermap.org/map/${weatherType}/{z}/{x}/{y}.png?appid=${WEATHER_API_KEY}`}
            opacity={0.5}
          />
        )}

        <UserLocationMarker showAccuracy={true} autoTrack={true} />

        <MapControls
          isConnected={isConnected}
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
          recenterCenter={initialCenter}
          showWeather={showWeather}
          onToggleWeather={handleToggleWeather}
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

      <div className="absolute bottom-6 left-6 z-[1000] w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/40 bg-white/85 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-white/10 dark:bg-[#0b1220]/80">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">Map Studio</p>
            <p className="text-xs text-slate-600 dark:text-slate-300">{activeAnimalCount} animaux visibles</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            live
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setDisplayMode('markers')}
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${displayMode === 'markers'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
              }`}
          >
            <Radar className="mx-auto mb-1 h-3.5 w-3.5" />
            markers
          </button>
          <button
            onClick={() => {
              setDisplayMode('heatmap');
              if (heatmapDensity === 0) setHeatmapDensity(24);
            }}
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${displayMode === 'heatmap'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
              }`}
          >
            <Waves className="mx-auto mb-1 h-3.5 w-3.5" />
            heatmap
          </button>
          <button
            onClick={() => {
              setDisplayMode('markers');
              setHeatmapDensity(0);
            }}
            className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600 transition-all hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
          >
            <Sparkles className="mx-auto mb-1 h-3.5 w-3.5" />
            auto
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/75 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-700 dark:text-slate-200">Traces historiques</span>
            <button
              onClick={() => setShowTrails((v) => !v)}
              className={`rounded-full px-2.5 py-1 font-semibold ${showTrails ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/15 dark:text-slate-200'}`}
            >
              {showTrails ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1"><Route className="h-3.5 w-3.5" /> Densite heatmap</span>
            <span className="font-semibold">{heatmapDensity > 0 ? heatmapDensity : 'OFF'}</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={heatmapDensity}
            onChange={(event) => setHeatmapDensity(parseInt(event.target.value, 10))}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-white/10"
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={handleStartPolygonDraw} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <PenSquare className="h-3.5 w-3.5" /> zone
          </button>
          <button onClick={handleDeleteMode} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:border-red-400 hover:text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <Trash2 className="h-3.5 w-3.5" /> delete
          </button>
          <button onClick={handleCancelGeomanMode} className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-semibold text-slate-700 hover:border-amber-400 hover:text-amber-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <Ban className="h-3.5 w-3.5" /> cancel
          </button>
        </div>
      </div>

    </div>
  );
});

RealTimeMap.displayName = 'RealTimeMap';

export default RealTimeMap;
