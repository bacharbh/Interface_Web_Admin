import { useMemo, useRef, useCallback } from 'react';
import { useMqtt } from '../contexts/MqttContext';

/**
 * useGeofencing — Manages geofence zones and boundary detection.
 * Uses Ray Casting algorithm for point-in-polygon detection.
 */

// Ray Casting Algorithm: Determine if point is inside polygon
const isPointInPolygon = (point, polygon) => {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

export function useGeofencing(zones) {
  // Check if a single animal is inside any geofence zone
  const isInsideAnyZone = useCallback((lat, lng) => {
    if (!zones || zones.length === 0) return true; // No zones = always safe
    return zones.some(zone => isPointInPolygon([lat, lng], zone.coords));
  }, [zones]);

  // Check all animals and return a status map
  const checkAllAnimals = useCallback((positions) => {
    const statusMap = {};
    Object.entries(positions).forEach(([id, animal]) => {
      const lat = typeof animal?.lat === 'number' ? animal.lat : 0;
      const lng = typeof animal?.lng === 'number' ? animal.lng : 0;
      const inside = isInsideAnyZone(lat, lng);
      statusMap[id] = inside ? 'SAFE' : 'OUT_OF_ZONE';
    });
    return statusMap;
  }, [isInsideAnyZone]);

  // Get overall geofence status for a single animal
  const getAnimalGeofenceStatus = useCallback((animal) => {
    if (!animal) return 'SAFE';
    const lat = typeof animal.lat === 'number' ? animal.lat : 0;
    const lng = typeof animal.lng === 'number' ? animal.lng : 0;
    return isInsideAnyZone(lat, lng) ? 'SAFE' : 'OUT_OF_ZONE';
  }, [isInsideAnyZone]);

  return {
    isInsideAnyZone,
    checkAllAnimals,
    getAnimalGeofenceStatus,
    isPointInPolygon,
  };
}

export default useGeofencing;
