import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import useInterval from '../../hooks/useInterval';
import { useIoTStore } from '../../hooks/useIoTStore';
import api from '../../services/api';

export interface Animal {
  id: string | number;
  lat: number;
  lng: number;
  status: 'normal' | 'warning' | 'alert';
}

export type LatLng = [number, number] | { lat: number; lng: number };

export interface MiniMapPreviewProps {
  animals: Animal[];
  geofence: LatLng[];
  onExpand: () => void;
}

type NormalizedCoord = [number, number];

const DEFAULT_CENTER: NormalizedCoord = [35.8245, 10.6346];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeCoord = (coord: LatLng): NormalizedCoord | null => {
  if (Array.isArray(coord)) {
    const [lat, lng] = coord;
    return isFiniteNumber(lat) && isFiniteNumber(lng) ? [lat, lng] : null;
  }

  if (coord && typeof coord === 'object') {
    const lat = coord.lat;
    const lng = coord.lng;
    return isFiniteNumber(lat) && isFiniteNumber(lng) ? [lat, lng] : null;
  }

  return null;
};

const normalizeAnimalCoord = (animal: Animal): NormalizedCoord | null =>
  isFiniteNumber(animal.lat) && isFiniteNumber(animal.lng) ? [animal.lat, animal.lng] : null;

// Ray casting algorithm to check whether a point is inside the geofence.
const isPointInPolygon = (point: NormalizedCoord, polygon: NormalizedCoord[]): boolean => {
  if (polygon.length === 0) {
    return true;
  }

  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = (yi > y) !== (yj > y);
    if (crosses) {
      const boundaryX = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < boundaryX) {
        inside = !inside;
      }
    }
  }

  return inside;
};

// Component to dynamically fit the bounds of the map to contain all animals or the geofence
function MapBoundsFitter({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [25, 25],
        maxZoom: 16,
        animate: false
      });
    }
  }, [map, bounds]);

  return null;
}

const getStatusColor = (status: 'normal' | 'warning' | 'alert') => {
  switch (status) {
    case 'normal':
      return 'var(--color-primary, #34c38f)';
    case 'warning':
      return 'var(--color-warning, #EF9F27)';
    case 'alert':
      return 'var(--color-danger, #E24B4A)';
    default:
      return 'var(--color-primary, #34c38f)';
  }
};

// Swaps the tile layer to CartoCDN on first OSM error
function TileLayerWithFallback() {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
    );
  }

  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      eventHandlers={{
        tileerror: () => setUseFallback(true),
      }}
    />
  );
}

const MiniMapPreview: React.FC<MiniMapPreviewProps> = ({
  animals = [],
  geofence = [],
  onExpand
}) => {
  const isSimulation = useIoTStore((state) => state.isSimulation);
  const setDevices = useIoTStore((state) => state.setDevices);
  const refreshInFlightRef = useRef(false);

  // 30-second interval refresh for animal positions (updates global store)
  useInterval(async () => {
    if (isSimulation || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const response = await api.get('/api/sheep', { timeout: 8000 });
      if (response?.data && Array.isArray(response.data)) {
        const devices: Record<string, any> = {};
        response.data.forEach((animal: any) => {
          const id = animal.collar_id || animal.id || `device_${Date.now()}`;
          const refreshedAt = new Date().toISOString();
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
            lastSeen: animal.lastSeen || animal.lastUpdate || animal.updatedAt || refreshedAt,
            lastUpdate: animal.lastUpdate || animal.lastSeen || animal.updatedAt || refreshedAt,
            updatedAt: animal.updatedAt || animal.lastUpdate || animal.lastSeen || refreshedAt,
            timestamp: Date.now(),
          };
        });
        setDevices(devices);
      }
    } catch (error) {
      console.warn('[MiniMapPreview] Failed to refresh animal positions:', error);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, 30000);

  const geofencePositions = useMemo(
    () => geofence.map(normalizeCoord).filter((coord): coord is NormalizedCoord => coord !== null),
    [geofence]
  );

  const validAnimals = useMemo(
    () => animals.map((animal) => ({ animal, coord: normalizeAnimalCoord(animal) }))
      .filter((item): item is { animal: Animal; coord: NormalizedCoord } => item.coord !== null),
    [animals]
  );

  const { inZoneCount, outOfZoneCount } = useMemo(() => {
    if (geofencePositions.length === 0) {
      return { inZoneCount: validAnimals.length, outOfZoneCount: 0 };
    }

    let inZone = 0;
    let outOfZone = 0;

    validAnimals.forEach(({ animal, coord }) => {
      const isInside = isPointInPolygon(coord, geofencePositions);
      if (isInside) {
        inZone++;
      } else {
        outOfZone++;
      }
    });

    return { inZoneCount: inZone, outOfZoneCount: outOfZone };
  }, [geofencePositions, validAnimals]);

  const mapBounds = useMemo(() => {
    const animalCoords = validAnimals.map(({ coord }) => coord);

    if (animalCoords.length > 0) {
      return L.latLngBounds(animalCoords);
    }

    if (geofencePositions.length > 0) {
      return L.latLngBounds(geofencePositions);
    }

    return null;
  }, [geofencePositions, validAnimals]);

  const mapCenter = useMemo<NormalizedCoord>(() => {
    if (mapBounds && mapBounds.isValid()) {
      const centerLatLng = mapBounds.getCenter();
      return [centerLatLng.lat, centerLatLng.lng];
    }

    if (geofencePositions.length > 0) {
      const centroid = geofencePositions.reduce(
        (accumulator, coord) => {
          accumulator.lat += coord[0];
          accumulator.lng += coord[1];
          return accumulator;
        },
        { lat: 0, lng: 0 }
      );

      return [centroid.lat / geofencePositions.length, centroid.lng / geofencePositions.length];
    }

    if (validAnimals.length > 0) {
      const centroid = validAnimals.reduce(
        (accumulator, { coord }) => {
          accumulator.lat += coord[0];
          accumulator.lng += coord[1];
          return accumulator;
        },
        { lat: 0, lng: 0 }
      );

      return [centroid.lat / validAnimals.length, centroid.lng / validAnimals.length];
    }

    return DEFAULT_CENTER;
  }, [geofencePositions, mapBounds, validAnimals]);

  const memoizedMarkers = useMemo(() => {
    return validAnimals.map(({ animal, coord }) => {
      const color = getStatusColor(animal.status);

      return (
        <CircleMarker
          key={animal.id}
          center={coord}
          radius={6}
          pathOptions={{
            color: '#ffffff',
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.95,
          }}
        />
      );
    });
  }, [validAnimals]);

  const memoizedPolygon = useMemo(() => {
    if (geofencePositions.length === 0) return null;

    return (
      <Polygon
        positions={geofencePositions}
        pathOptions={{
          color: 'var(--color-primary, #34c38f)',
          dashArray: '5, 5',
          weight: 2,
          fillColor: 'var(--color-primary, #34c38f)',
          fillOpacity: 0.08,
        }}
      />
    );
  }, [geofencePositions]);

  return (
    <div
      className="w-full relative shadow-sm border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-card-dark select-none z-0 overflow-hidden"
      style={{
        height: '240px',
        borderRadius: '12px'
      }}
    >
      <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-card-dark/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 pointer-events-none flex items-center transition-all select-none">
        <span>🟢 {inZoneCount} animaux en zone</span>
        <span className="mx-1.5 text-slate-300 dark:text-slate-700">/</span>
        <span>🔴 {outOfZoneCount} hors zone</span>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={14}
        dragging={false}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        touchZoom={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayerWithFallback />

        {memoizedPolygon}
        {memoizedMarkers}

        <MapBoundsFitter bounds={mapBounds} />
      </MapContainer>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        className="absolute bottom-3 right-3 z-[1000] px-3.5 py-2 bg-white dark:bg-card-dark text-slate-700 dark:text-slate-200 hover:text-primary dark:hover:text-primary font-semibold text-[11px] rounded-xl shadow-md border border-slate-150 dark:border-slate-800 backdrop-blur-sm transition-all flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer pointer-events-auto active:scale-95"
      >
        <span>View Full Map</span>
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

MiniMapPreview.displayName = 'MiniMapPreview';

export default memo(MiniMapPreview);
