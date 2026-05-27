import React, { useEffect, useRef } from 'react';
import Button from '../../components/ui/Button';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { IAnimal } from '../../types';

interface AnimalMarkerProps {
  animal: IAnimal;
  history?: [number, number][];
  isSelected: boolean;
  onSelect: (id: string) => void;
  variant?: 'simple' | 'detailed';
}

const markerIconCache: Record<string, L.DivIcon> = {};

const AnimalMarker = React.memo(({ animal, history = [], isSelected, onSelect, variant = 'detailed' }: AnimalMarkerProps) => {
  const markerRef = useRef<L.Marker | null>(null);
  const navigate = useNavigate();
  const lat = typeof animal.lat === 'number' ? animal.lat : 0;
  const lng = typeof animal.lng === 'number' ? animal.lng : 0;
  const battery = animal.battery ?? 0;
  const temperature = animal.temperature ?? 0;
  // Use pre-computed ML result from the worker, fallback to default if not available
  const anomaly = (animal as any).mlResult || { label: 'normal', confidence: 1.0 };

  // Status-based coloring override by ML
  const isSuspect = anomaly.label === 'suspect';
  const isCriticalML = anomaly.label === 'critical';

  useEffect(() => {
    if (isSelected) {
      window.setTimeout(() => {
        markerRef.current?.openPopup();
      }, 0);
    } else {
      markerRef.current?.closePopup();
    }
  }, [isSelected]);

  const cacheKey = `${animal.status}_${isSelected}_${anomaly.label}_${variant}`;

  let customIcon = markerIconCache[cacheKey];
  if (!customIcon) {
    const statusColor = {
      SAFE: '#16a34a',
      OUT_OF_ZONE: '#f59e0b', // user requested orange for out/low
      LOW_BATTERY: '#f59e0b',
      CRITICAL: '#ef4444', // user requested red for critical
    }[animal.status] || '#16a34a';

    const animationClass = 'transition-transform duration-200';

    const glowClass = variant === 'simple'
      ? `shadow-sm ${isSelected ? 'ring-2 ring-primary ring-offset-2 dark:ring-offset-gray-900' : 'ring-1 ring-white/70 dark:ring-gray-700'}`
      : (animal.status === 'CRITICAL' || isCriticalML)
        ? 'ring-4 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
        : (animal.status === 'LOW_BATTERY' || animal.status === 'OUT_OF_ZONE')
          ? 'ring-4 ring-orange-500/50 shadow-[0_0_15px_rgba(245,158,11,0.8)]'
          : (isSelected ? 'scale-125 z-50 ring-4 ring-primary ring-offset-2 dark:ring-offset-gray-900 shadow-[0_0_15px_rgba(var(--color-primary),0.5)]' : 'scale-100');

    customIcon = L.divIcon({
      html: `
        <div class="relative group ${animationClass}">
          <div class="${variant === 'simple' ? 'w-5 h-5' : 'w-9 h-9'} rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center transition-all duration-500 ${glowClass}" style="background-color: ${statusColor}">
            ${variant === 'simple'
          ? '<div class="h-2 w-2 rounded-full bg-white/95 pointer-events-none"></div>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-white drop-shadow-sm pointer-events-none"><path d="M16 16c-1.1 0-2-.9-2-2 0-.2.1-.4.1-.6-.8-.3-1.6-.3-2.3 0 .1.2.1.4.1.6 0 1.1-.9 2-2 2s-2-.9-2-2c0-.2.1-.4.1-.6C7.2 13 6.6 12 6.6 10.9c0-2.3 2.1-4.2 4.6-4.2h1.6c2.5 0 4.6 1.9 4.6 4.2 0 1.1-.6 2.1-1.4 2.6.1.2.1.4.1.6 0 1.1-.9 2-2 2z"/><path d="M8 16v4"/><path d="M16 16v4"/></svg>'}
          </div>
          ${(animal.status === 'CRITICAL' || isCriticalML) ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 animate-ping shadow-lg pointer-events-none"></div>' : ''}
          ${isSelected ? '<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full animate-bounce pointer-events-none"></div>' : ''}
        </div>
      `,
      className: 'custom-animal-icon',
      iconSize: variant === 'simple' ? [30, 30] : [42, 42],
      iconAnchor: variant === 'simple' ? [15, 15] : [21, 21],
      popupAnchor: [0, -18],
      // add compact animal data to icon options for cluster popups
      // @ts-ignore
      status: animal.status,
      // @ts-ignore
      animal: { collar_id: animal.collar_id, name: animal.name, status: animal.status, battery: animal.battery }
    });
    markerIconCache[cacheKey] = customIcon;
  }

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={customIcon}
      eventHandlers={{
        click: () => {
          onSelect(animal.collar_id);
        },
      }}
    >
      <Popup className="custom-popup" offset={[0, -10]}>
        <div className="p-4 min-w-[240px] bg-white dark:bg-card-dark text-gray-900 dark:text-white rounded-2xl shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={(animal as any).avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${animal.collar_id}`}
              className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 object-cover border-2 border-gray-200 dark:border-gray-700"
              alt="Avatar"
            />
            <div className="flex-1">
              <h3 className="title-sm text-gray-900 dark:text-white">{animal.name}</h3>
              <p className="label-xs">
                {new Date((animal as any).last_heartbeat || Date.now()).toLocaleTimeString()}
              </p>
            </div>
            <span className={`px-2 py-1 rounded-md label-xs font-black text-white ${animal.status === 'SAFE' ? 'bg-green-500' :
              animal.status === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
              }`}>
              {animal.status.toLowerCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <p className="label-xs mb-1 font-bold">Activité</p>
              <p className="title-sm text-blue-500">
                {animal.activity_level === 4 ? '⚠️ PANIQUE' :
                  animal.activity_level === 3 ? 'Course' :
                    animal.activity_level === 1 ? 'Pâturage' : 'Repos'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <p className="label-xs mb-1 font-bold">Rythme card.</p>
              <p className="title-sm text-red-500">{animal.heartRate || 75} BPM</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <p className="label-xs mb-1 font-bold">Batterie</p>
              <p className={`title-sm ${battery < 20 ? 'text-red-500' : 'text-green-500'}`}>{battery}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <p className="label-xs mb-1 font-bold">Température</p>
              <p className="title-sm text-primary">{temperature}°C</p>
            </div>
          </div>

          <Button
            variant="secondary"
            className="mt-4 w-full py-2"
            onClick={() => navigate(`/animals/${animal.collar_id}`)}
          >
            Voir profil →
          </Button>
        </div>
      </Popup>
    </Marker>
  );
}, (prev, next) => {
  return (
    prev.animal.lat === next.animal.lat &&
    prev.animal.lng === next.animal.lng &&
    prev.animal.status === next.animal.status &&
    prev.isSelected === next.isSelected &&
    prev.variant === next.variant &&
    prev.animal.battery === next.animal.battery &&
    prev.animal.health === next.animal.health &&
    (prev.animal as any).mlResult?.label === (next.animal as any).mlResult?.label
  );
});

AnimalMarker.displayName = 'AnimalMarker';

export default AnimalMarker;
