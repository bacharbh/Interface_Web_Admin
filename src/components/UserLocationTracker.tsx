import React, { useState, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Crosshair } from 'lucide-react';

interface UserLocationTrackerProps {
  onLocationUpdate?: (lat: number, lng: number) => void;
  showAccuracy?: boolean;
  autoTrack?: boolean;
}

export const UserLocationTracker: React.FC<UserLocationTrackerProps> = ({
  onLocationUpdate,
  showAccuracy = true,
  autoTrack = true
}) => {
  const map = useMap();
  const [userPosition, setUserPosition] = useState<L.LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        const latLng = new L.LatLng(latitude, longitude);
        
        setUserPosition(latLng);
        setAccuracy(acc);
        
        if (onLocationUpdate) {
          onLocationUpdate(latitude, longitude);
        }

        if (autoTrack) {
          map.setView(latLng, 16, { animate: true });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    setWatchId(id);
    setIsTracking(true);
  }, [map, onLocationUpdate, autoTrack]);

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsTracking(false);
    }
  }, [watchId]);

  const centerOnUser = useCallback(() => {
    if (userPosition) {
      map.setView(userPosition, 16, { animate: true });
    } else {
      startTracking();
    }
  }, [userPosition, map, startTracking]);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return (
    <>
      {/* User position marker */}
      {userPosition && (
        <>
          <L.CircleMarker
            center={userPosition}
            radius={showAccuracy && accuracy ? accuracy : 10}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
              weight: 2
            }}
          />
          <L.Marker
            position={userPosition}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: `
                <div style="
                  position: relative;
                  width: 24px;
                  height: 24px;
                  background: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
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
                    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
                    50% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
                  }
                </style>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })}
          />
        </>
      )}

      {/* Control buttons */}
      <div className="leaflet-control-container">
        <div className="leaflet-top-right" style={{ top: '80px', right: '10px' }}>
          <div className="leaflet-bar leaflet-control">
            <button
              onClick={isTracking ? stopTracking : startTracking}
              className="leaflet-control-zoom-in"
              title={isTracking ? "Arrêter le suivi" : "Suivre ma position"}
              style={{
                backgroundColor: isTracking ? '#3b82f6' : 'white',
                color: isTracking ? 'white' : '#3b82f6'
              }}
            >
              <Navigation size={18} />
            </button>
            <button
              onClick={centerOnUser}
              className="leaflet-control-zoom-in"
              title="Recentrer sur ma position"
            >
              <Crosshair size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserLocationTracker;
