import React, { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HistoryPoint {
  lat: number;
  lng: number;
  [key: string]: any;
}

interface HeatMapLayerProps {
  data: HistoryPoint[];
}

const HeatMapLayer = ({ data }: HeatMapLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Convert data to [lat, lng, intensity]
    const points: [number, number, number][] = data.map(p => [p.lat, p.lng, 0.5]);

    // @ts-ignore - Leaflet.heat adds heatLayer to L
    const heatLayer = L.heatLayer(points, {
      radius: 20,
      blur: 15,
      maxZoom: 15,
      gradient: {
        0.4: '#10b981', // emerald-500
        0.6: '#f59e0b', // amber-500
        1.0: '#ef4444'  // red-500
      }
    }).addTo(map);

    // Fit bounds to data
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, data]);

  return null;
};

interface GPSHeatmapProps {
  data: HistoryPoint[];
  theme?: string;
}

const GPSHeatmap = ({ data, theme }: GPSHeatmapProps) => {
  return (
    <div className="h-[400px] w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 shadow-inner group relative">
      <MapContainer
        center={[35.8245, 10.6346]}
        zoom={13}
        style={{ height: '100%', width: '100%', filter: theme === 'dark' ? 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <HeatMapLayer data={data} />
      </MapContainer>
      
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 shadow-lg pointer-events-none">
        <p className="label-xs font-black text-slate-800 dark:text-slate-100">Densité de présence</p>
      </div>
    </div>
  );
};

export default GPSHeatmap;
