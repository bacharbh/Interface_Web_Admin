import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import { useIoTStore } from '../../../hooks/useIoTStore';

const DEFAULT_CENTER: [number, number] = [35.8245, 10.6346];

interface HeatmapOptions {
  radius: number;
  blur: number;
  maxZoom: number;
  max: number;
}

const HeatmapLayer = ({ points, options }: { points: [number, number, number][]; options: HeatmapOptions }) => {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    const heat = (L as typeof L & { heatLayer: (pts: [number, number, number][], cfg: HeatmapOptions) => L.Layer })
      .heatLayer(points, options)
      .addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points, options]);
  return null;
};

const GPSHeatmap = () => {
  const devices = useIoTStore((state) => state.devices);

  const heatPoints = useMemo(() =>
    Object.values(devices)
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number' && isFinite(d.lat!) && isFinite(d.lng!))
      .map((d) => [d.lat as number, d.lng as number, 0.8] as [number, number, number]),
    [devices]
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (heatPoints.length === 0) return DEFAULT_CENTER;
    const lat = heatPoints.reduce((s, p) => s + p[0], 0) / heatPoints.length;
    const lng = heatPoints.reduce((s, p) => s + p[1], 0) / heatPoints.length;
    return [lat, lng];
  }, [heatPoints]);

  const heatOptions = useMemo<HeatmapOptions>(() => ({
    radius: 40,
    blur: 28,
    maxZoom: 17,
    max: 1.0,
  }), []);

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {heatPoints.length > 0 && (
          <HeatmapLayer points={heatPoints} options={heatOptions} />
        )}
        {heatPoints.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p[0], p[1]]}
            radius={5}
            pathOptions={{
              color: '#10B981',
              fillColor: '#10B981',
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default GPSHeatmap;
