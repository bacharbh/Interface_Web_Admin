import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapPin, Crosshair, Layers } from 'lucide-react';
import { IAnimal, IGeofenceZone } from '../../types';
import { getCurrentCenter } from '../../utils/simulation_FIXED';
import { useTheme } from '../../contexts/ThemeContext';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Simple marker icon - clean and minimal
const createSimpleMarkerIcon = (status: string, isSelected: boolean) => {
  const color = {
    SAFE: '#16a34a',
    OUT_OF_ZONE: '#f59e0b',
    LOW_BATTERY: '#0284c7',
    CRITICAL: '#dc2626',
  }[status] || '#6b7280';

  const size = isSelected ? 28 : 20;

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      "></div>
    `,
    className: 'simple-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Simple cluster icon
const createSimpleClusterIcon = (cluster: any) => {
  const childCount = cluster.getChildCount();
  const size = Math.min(50, 25 + childCount);

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${Math.max(12, size / 3)}px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        ${childCount}
      </div>
    `,
    className: 'simple-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Map view sync
const MapViewSync = ({ initialCenter }: { initialCenter: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(initialCenter, 14);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialCenter, map]);

  return null;
};

// Geofence layer - minimal
const GeofenceLayer = ({ zones }: { zones: IGeofenceZone[] }) => {
  const map = useMap();

  useEffect(() => {
    const layers: L.Polygon[] = [];

    zones.forEach(zone => {
      if (!zone.coords || zone.coords.length < 3) return;

      const polygon = L.polygon(zone.coords, {
        color: '#3b82f6',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
      }).addTo(map);

      layers.push(polygon);
    });

    return () => {
      layers.forEach(layer => map.removeLayer(layer));
    };
  }, [map, zones]);

  return null;
};

interface RealTimeMapMinimalProps {
  animalsList: IAnimal[];
  zones: IGeofenceZone[];
  selectedAnimalId: string | null;
  onSelectAnimal: (id: string | null) => void;
  isSimulation: boolean;
  isConnected: boolean;
}

const RealTimeMapMinimal: React.FC<RealTimeMapMinimalProps> = ({
  animalsList,
  zones,
  selectedAnimalId,
  onSelectAnimal,
  isSimulation,
  isConnected,
}) => {
  const { theme } = useTheme();
  const mapRef = useRef<any>(null);

  // Simple state
  const [showClusters, setShowClusters] = useState(true);

  // Process animals - only valid positions
  const processedAnimals = useMemo(() => {
    return animalsList
      .filter((animal) => typeof animal.lat === 'number' && typeof animal.lng === 'number')
      .map((animal) => ({
        ...animal,
        id: animal.collar_id,
      }));
  }, [animalsList]);

  // Calculate center
  const initialCenter: [number, number] = useMemo(() => {
    const currentCenter = getCurrentCenter();
    if (currentCenter) return [currentCenter.lat, currentCenter.lng];
    
    // Fallback to animals center
    if (processedAnimals.length > 0) {
      const total = processedAnimals.reduce((acc, a) => {
        acc.lat += a.lat;
        acc.lng += a.lng;
        return acc;
      }, { lat: 0, lng: 0 });
      return [total.lat / processedAnimals.length, total.lng / processedAnimals.length] as [number, number];
    }

    // Default to Paris
    return [48.8566, 2.3522];
  }, [processedAnimals]);

  // Handle recenter
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(initialCenter, 14, { animate: true });
  }, [initialCenter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = processedAnimals.length;
    const critical = processedAnimals.filter(a => a.status === 'CRITICAL').length;
    const outOfZone = processedAnimals.filter(a => a.status === 'OUT_OF_ZONE').length;
    const lowBattery = processedAnimals.filter(a => a.battery < 20).length;
    return { total, critical, outOfZone, lowBattery };
  }, [processedAnimals]);

  return (
    <div className="relative flex flex-1 h-full min-h-[500px] overflow-hidden rounded-xl bg-white dark:bg-gray-900">
      <MapContainer
        center={initialCenter}
        zoom={14}
        className="w-full"
        zoomControl={false}
        whenReady={(mapInstance) => { mapRef.current = mapInstance; }}
        style={{ height: '100%', width: '100%' }}
      >
        <MapViewSync initialCenter={initialCenter} />
        
        {/* Clean tile layer */}
        <TileLayer
          attribution=''
          url={theme === 'dark' 
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />

        {/* Minimal geofence */}
        {zones.length > 0 && <GeofenceLayer zones={zones} />}

        {/* Markers with optional clustering */}
        {showClusters && processedAnimals.length > 50 ? (
          <MarkerClusterGroup 
            maxClusterRadius={40} 
            disableClusteringAtZoom={14} 
            iconCreateFunction={createSimpleClusterIcon}
            showCoverageOnHover={false}
          >
            {processedAnimals.map((animal) => (
              <Marker
                key={animal.id}
                position={[animal.lat, animal.lng]}
                icon={createSimpleMarkerIcon(animal.status, selectedAnimalId === animal.id)}
                eventHandlers={{
                  click: () => onSelectAnimal(animal.id),
                }}
              />
            ))}
          </MarkerClusterGroup>
        ) : (
          processedAnimals.map((animal) => (
            <Marker
              key={animal.id}
              position={[animal.lat, animal.lng]}
              icon={createSimpleMarkerIcon(animal.status, selectedAnimalId === animal.id)}
              eventHandlers={{
                click: () => onSelectAnimal(animal.id),
              }}
            />
          ))
        )}
      </MapContainer>

      {/* Minimal top-left stats */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Total</span>
              <span className="ml-2 font-bold text-gray-900 dark:text-white">{stats.total}</span>
            </div>
            {stats.critical > 0 && (
              <>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                <div>
                  <span className="text-red-500">Critiques</span>
                  <span className="ml-2 font-bold text-red-600">{stats.critical}</span>
                </div>
              </>
            )}
            {stats.outOfZone > 0 && (
              <>
                <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                <div>
                  <span className="text-amber-500">Hors zone</span>
                  <span className="ml-2 font-bold text-amber-600">{stats.outOfZone}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Minimal right controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Recenter button */}
        <button
          onClick={handleRecenter}
          className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Recentrer"
        >
          <Crosshair size={20} className="text-gray-600 dark:text-gray-300" />
        </button>

        {/* Toggle clustering */}
        {processedAnimals.length > 50 && (
          <button
            onClick={() => setShowClusters(!showClusters)}
            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Clusters"
          >
            <Layers size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        )}
      </div>

      {/* Minimal bottom status */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000]">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {isConnected ? 'Connecté' : 'Déconnecté'}
            </span>
            {isSimulation && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-amber-600">Simulation</span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {processedAnimals.length} animaux
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMapMinimal;
