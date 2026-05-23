import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { IAnimal } from '../../types';

interface MiniMapWidgetProps {
  animals: IAnimal[];
}

export default function MiniMapWidget({ animals }: MiniMapWidgetProps) {
  const center: [number, number] = useMemo(() => {
    if (animals.length === 0) return [33.885, -5.54];
    const validAnimals = animals.filter((animal) => typeof animal.lat === 'number' && typeof animal.lng === 'number');
    if (validAnimals.length === 0) return [33.885, -5.54];

    const { sumLat, sumLng } = validAnimals.reduce((acc, animal) => {
      acc.sumLat += animal.lat ?? 0;
      acc.sumLng += animal.lng ?? 0;
      return acc;
    }, { sumLat: 0, sumLng: 0 });

    return [sumLat / validAnimals.length, sumLng / validAnimals.length];
  }, [animals]);

  if (animals.length === 0) {
    return <div className="p-6 bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse h-full min-h-[250px]" />;
  }

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full overflow-hidden relative min-h-[250px]">
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex items-center justify-between pointer-events-none">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white drop-shadow-md bg-white/80 dark:bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-auto backdrop-blur-sm border border-gray-200 dark:border-gray-700">
          <MapPin className="w-4 h-4 text-primary" /> Mini-Carte Live
        </h3>
      </div>
      <div className="flex-1 h-[250px] w-full z-0">
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={false}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          {animals.slice(0, 150).map(animal => {
            const lat = typeof animal.lat === 'number' ? animal.lat : 33.885;
            const lng = typeof animal.lng === 'number' ? animal.lng : -5.54;
            const isCritical = animal.status === 'CRITICAL';
            const isOutOfZone = animal.status === 'OUT_OF_ZONE';
            const color = isCritical ? '#ef4444' : isOutOfZone ? '#f59e0b' : '#3b82f6';

            return (
              <CircleMarker
                key={animal.collar_id}
                center={[lat, lng]}
                radius={isCritical ? 5 : 3}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 1
                }}
              />
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
