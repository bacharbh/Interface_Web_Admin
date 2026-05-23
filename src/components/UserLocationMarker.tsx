import React, { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import useGeolocation from '../hooks/useGeolocation';

// Custom user location icon
const userIcon = L.divIcon({
  html: `
    <div style="
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      position: relative;
      animation: pulse 2s infinite;
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
        }
      }
    </style>
  `,
  className: 'user-location-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

// Accuracy circle icon
const accuracyCircleIcon = (accuracy: number) => {
  const radius = Math.min(accuracy, 100); // Cap the visual radius at 100m
  return L.divIcon({
    html: `
      <div style="
        background: rgba(59, 130, 246, 0.2);
        border: 2px solid rgba(59, 130, 246, 0.4);
        border-radius: 50%;
        width: ${radius * 2}px;
        height: ${radius * 2}px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div>
    `,
    className: 'accuracy-circle',
    iconSize: [radius * 2, radius * 2],
    iconAnchor: [radius, radius]
  });
};

interface UserLocationMarkerProps {
  showAccuracy?: boolean;
  autoTrack?: boolean;
  onLocationUpdate?: (position: any) => void;
}

const UserLocationMarker: React.FC<UserLocationMarkerProps> = ({
  showAccuracy = true,
  autoTrack = true,
  onLocationUpdate
}) => {
  const map = useMap();
  const { position, error, isLoading, watchPosition, stopWatching } = useGeolocation();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (autoTrack) {
      watchPosition();
    }
    
    return () => {
      if (autoTrack) {
        stopWatching();
      }
    };
  }, [autoTrack, watchPosition, stopWatching]);

  useEffect(() => {
    if (position && !hasCentered.current) {
      // Center map on user's location on first position update
      map.setView([position.latitude, position.longitude], 16);
      hasCentered.current = true;
    }

    if (position && onLocationUpdate) {
      onLocationUpdate(position);
    }
  }, [position, map, onLocationUpdate]);

  if (isLoading) {
    return (
      <div className="absolute top-4 left-4 z-[1000] bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm text-gray-700 dark:text-gray-300">Getting location...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute top-4 left-4 z-[1000] bg-red-50 dark:bg-red-900/20 rounded-lg shadow-lg p-3">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-red-700 dark:text-red-300">{error.message}</span>
        </div>
      </div>
    );
  }

  if (!position) {
    return null;
  }

  return (
    <>
      {/* Accuracy circle */}
      {showAccuracy && position.accuracy && (
        <Marker
          position={[position.latitude, position.longitude]}
          icon={accuracyCircleIcon(position.accuracy)}
        />
      )}
      
      {/* User location marker */}
      <Marker
        position={[position.latitude, position.longitude]}
        icon={userIcon}
      >
        <Popup>
          <div className="text-sm">
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">
              Your Location
            </div>
            <div className="space-y-1">
              <div><strong>Latitude:</strong> {position.latitude.toFixed(6)}°</div>
              <div><strong>Longitude:</strong> {position.longitude.toFixed(6)}°</div>
              {position.accuracy && (
                <div><strong>Accuracy:</strong> ±{position.accuracy.toFixed(0)}m</div>
              )}
              {position.altitude && (
                <div><strong>Altitude:</strong> {position.altitude.toFixed(0)}m</div>
              )}
              {position.speed && position.speed > 0 && (
                <div><strong>Speed:</strong> {(position.speed * 3.6).toFixed(1)} km/h</div>
              )}
              <div><strong>Last Updated:</strong> {new Date(position.timestamp).toLocaleTimeString()}</div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => map.setView([position.latitude, position.longitude], 18)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded"
              >
                Center Here
              </button>
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

export default UserLocationMarker;
