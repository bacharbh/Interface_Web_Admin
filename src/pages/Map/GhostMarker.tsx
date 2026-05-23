import React from 'react';
import L from 'leaflet';
import { Marker, Circle, Tooltip } from 'react-leaflet';
import { IAnimal } from '../../types';

interface GhostMarkerProps {
  animal: IAnimal;
  predictedPos: { lat: number; lng: number };
  confidenceRadius: number;
  lastSeenMin: number;
}

/**
 * @component GhostMarker
 * @description Renders a predicted position for animals with stale GPS.
 */
const GhostMarker = ({ animal, predictedPos, confidenceRadius, lastSeenMin }: GhostMarkerProps) => {
  const ghostIcon = L.divIcon({
    html: `
      <div class="relative opacity-50 grayscale">
        <div class="w-8 h-8 rounded-full border-4 border-dashed border-gray-400 flex items-center justify-center bg-gray-200">
          <span class="text-gray-500 text-xs">👻</span>
        </div>
      </div>
    `,
    className: 'ghost-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return (
    <>
      <Marker position={[predictedPos.lat, predictedPos.lng]} icon={ghostIcon}>
        <Tooltip permanent direction="top" className="bg-white/80 backdrop-blur-md rounded-lg shadow-lg border-none label-xs p-2">
          Vu il y a {lastSeenMin} min • Prédit ± {confidenceRadius}m
        </Tooltip>
      </Marker>
      
      <Circle
        center={[predictedPos.lat, predictedPos.lng]}
        radius={confidenceRadius}
        pathOptions={{
          color: '#94a3b8',
          fillColor: '#cbd5e1',
          fillOpacity: 0.1,
          dashArray: '5, 10',
          weight: 1
        }}
        className="animate-pulse-slow"
      />
    </>
  );
};

export default GhostMarker;
