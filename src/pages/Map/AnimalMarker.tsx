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

    const animationClass = 'transition-transform duration-300 ease-out';

    const basePulse = animal.status === 'CRITICAL' || isCriticalML
      ? `<div class="absolute inset-0 rounded-full animate-ping opacity-75" style="background-color: ${statusColor}"></div>`
      : animal.status === 'LOW_BATTERY' || animal.status === 'OUT_OF_ZONE'
        ? `<div class="absolute inset-0 rounded-full animate-ping opacity-40" style="background-color: ${statusColor}; animation-duration: 2s;"></div>`
        : '';

    const glowClass = isSelected
      ? `scale-125 z-50 ring-4 ring-white shadow-2xl`
      : 'scale-100 hover:scale-110 shadow-lg';

    customIcon = L.divIcon({
      html: `
        <div class="relative group ${animationClass} flex items-center justify-center">
          ${basePulse}
          <div class="relative ${variant === 'simple' ? 'w-4 h-4' : 'w-8 h-8'} rounded-full border-2 border-white flex items-center justify-center transition-all duration-300 ${glowClass}" style="background-color: ${statusColor}; box-shadow: 0 2px 10px ${statusColor}80;">
            ${variant === 'simple'
          ? ''
          : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'}
          </div>
          ${isSelected ? `<div class="absolute -bottom-3 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full shadow-sm" style="background-color: ${statusColor}"></div>` : ''}
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
        <div className="p-5 min-w-[280px] bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl text-gray-900 dark:text-white rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50">
          <div className="flex items-start gap-4 mb-5">
            <div className="relative">
              <img
                src={(animal as any).avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${animal.collar_id}`}
                className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                alt="Avatar"
              />
              <span className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-lg text-[10px] font-black text-white shadow-sm ${animal.status === 'SAFE' ? 'bg-green-500' :
                animal.status === 'CRITICAL' ? 'bg-red-500' : 'bg-orange-500'
                }`}>
                {animal.status}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{animal.name || `Collier #${animal.collar_id}`}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                Maj: {new Date((animal as any).last_heartbeat || Date.now()).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs mb-5">
            <div className="flex flex-col gap-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Batterie</span>
              <span className={`font-bold ${battery < 20 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{battery}%</span>
            </div>
            <div className="flex flex-col gap-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vitesse</span>
              <span className="font-bold text-gray-900 dark:text-white">{animal.speed ? `${animal.speed.toFixed(1)} km/h` : '0 km/h'}</span>
            </div>
            <div className="flex flex-col gap-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Température</span>
              <span className="font-bold text-primary">{temperature}°C</span>
            </div>
            <div className="flex flex-col gap-1 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Coordonnées</span>
              <span className="font-bold text-gray-900 dark:text-white text-[10px]">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent"
              onClick={() => navigate(`/animals/${animal.collar_id}`)}
            >
              Historique
            </Button>
            <Button
              variant="primary"
              className="flex-1 py-2 text-xs font-semibold shadow-md shadow-primary/20"
              onClick={() => navigate(`/animals/${animal.collar_id}`)}
            >
              Détails complets
            </Button>
          </div>
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
