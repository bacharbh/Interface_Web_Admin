import { useState, useEffect, useCallback, useRef } from 'react';

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

const getErrorMessage = (code: number): string => {
  switch (code) {
    case 1: return 'Permission de localisation refusée.';
    case 2: return 'Localisation indisponible.';
    case 3: return 'Délai de localisation dépassé.';
    default: return 'Erreur de localisation inconnue.';
  }
};

const useGeolocation = (): UseGeolocationReturn => {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Use a ref (not state) so watchPosition/stopWatching don't change identity
  const watchIdRef = useRef<number | null>(null);

  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: 0, message: 'Géolocalisation non supportée' });
        return;
      }
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeolocationPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude ?? undefined,
            altitudeAccuracy: pos.coords.altitudeAccuracy ?? undefined,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
            timestamp: pos.timestamp,
          };
          setPosition(geoPos);
          setError(null);
          setIsLoading(false);
          resolve(geoPos);
        },
        (err) => {
          const geoErr: GeolocationError = { code: err.code, message: getErrorMessage(err.code) };
          setError(geoErr);
          setIsLoading(false);
          reject(geoErr);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []); // stable — no deps

  // stable — uses ref, not state
  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError({ code: 0, message: 'Géolocalisation non supportée' });
      return;
    }
    if (watchIdRef.current !== null) return; // already watching

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? undefined,
          altitudeAccuracy: pos.coords.altitudeAccuracy ?? undefined,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          timestamp: pos.timestamp,
        });
        setError(null);
        setIsLoading(false);
      },
      (err) => {
        setError({ code: err.code, message: getErrorMessage(err.code) });
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    watchIdRef.current = id;
  }, []); // stable — no deps

  // stable — uses ref, not state
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []); // stable — no deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Get one-shot position on mount
  useEffect(() => {
    getCurrentPosition().catch(() => {});
  }, [getCurrentPosition]);

  return { position, error, isLoading, watchPosition, stopWatching, getCurrentPosition };
};

export default useGeolocation;
