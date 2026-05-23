import { useState, useEffect, useCallback } from 'react';

interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface GeolocationError {
  code: number;
  message: string;
}

interface UseGeolocationReturn {
  position: GeolocationPosition | null;
  error: GeolocationError | null;
  isLoading: boolean;
  watchPosition: () => void;
  stopWatching: () => void;
  getCurrentPosition: () => Promise<GeolocationPosition>;
}

const useGeolocation = (): UseGeolocationReturn => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({
          code: 0,
          message: 'Geolocation is not supported by this browser'
        });
        return;
      }

      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const geoPosition: GeolocationPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp
          };
          
          setPosition(geoPosition);
          setError(null);
          setIsLoading(false);
          resolve(geoPosition);
        },
        (error) => {
          const geoError: GeolocationError = {
            code: error.code,
            message: getErrorMessage(error.code)
          };
          
          setError(geoError);
          setPosition(null);
          setIsLoading(false);
          reject(geoError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);

  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      });
      return;
    }

    if (watchId !== null) {
      // Already watching
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const geoPosition: GeolocationPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp
        };
        
        setPosition(geoPosition);
        setError(null);
        setIsLoading(false);
      },
      (error) => {
        const geoError: GeolocationError = {
          code: error.code,
          message: getErrorMessage(error.code)
        };
        
        setError(geoError);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000 // Accept positions that are up to 5 seconds old
      }
    );

    setWatchId(id);
  }, [watchId]);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Get initial position on mount
  useEffect(() => {
    getCurrentPosition().catch(() => {
      // Silently fail initial position request
    });
  }, [getCurrentPosition]);

  return {
    position,
    error,
    isLoading,
    watchPosition,
    stopWatching,
    getCurrentPosition
  };
};

const getErrorMessage = (code: number): string => {
  switch (code) {
    case 1:
      return 'Location permission denied. Please enable location access in your browser settings.';
    case 2:
      return 'Location information is unavailable.';
    case 3:
      return 'Location request timed out.';
    default:
      return 'An unknown error occurred while retrieving location.';
  }
};

export default useGeolocation;
