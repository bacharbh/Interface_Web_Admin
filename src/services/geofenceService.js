import api from './api';

/**
 * Transform GeoJSON format to frontend format
 */
const transformZoneFromBackend = (zone) => {
  if (!zone) return null;

  const normalizedType = zone.type || zone.zoneType || 'safe';
  const normalizedColor = zone.color || (normalizedType === 'alert' ? '#ef4444' : normalizedType === 'exclusion' ? '#f59e0b' : '#16a34a');

  // If already in frontend format (has coords), return as is
  if (zone.coords) {
    return {
      ...zone,
      color: normalizedColor,
      type: normalizedType,
    };
  }

  // Transform GeoJSON format to frontend format
  if (zone.geometry && zone.geometry.coordinates && zone.geometry.coordinates[0]) {
    return {
      id: zone.id,
      name: zone.name,
      coords: zone.geometry.coordinates[0].map(coord => [coord[1], coord[0]]), // GeoJSON is [lng, lat], convert to [lat, lng]
      color: normalizedColor,
      type: normalizedType,
      description: zone.description,
      isActive: zone.isActive,
      alertThreshold: zone.alertThreshold,
      notificationChannels: zone.notificationChannels,
    };
  }

  return zone;
};

/**
 * Transform frontend format to GeoJSON for backend
 */
const transformZoneToBackend = (zone) => {
  if (!zone) return null;

  // If already in backend GeoJSON format, return as is
  if (zone.geometry) {
    return zone;
  }

  // Transform frontend format to GeoJSON
  if (zone.coords && Array.isArray(zone.coords)) {
    return {
      name: zone.name,
      description: zone.description || '',
      type: zone.type || 'safe',
      geometry: {
        type: 'Polygon',
        coordinates: [zone.coords.map(coord => [coord[1], coord[0]])] // Convert [lat, lng] to [lng, lat] for GeoJSON
      },
      isActive: zone.isActive !== false,
      alertThreshold: zone.alertThreshold || 1,
      notificationChannels: zone.notificationChannels || ['websocket']
    };
  }

  return zone;
};

/**
 * GeofenceService — Logic to sync grazing zones with MongoDB.
 */
const geofenceService = {
  getZones: async () => {
    try {
      const response = await api.get('/geofence');
      const zones = response.data.geofences || [];
      return zones.map(transformZoneFromBackend).filter(z => z !== null);
    } catch (error) {
      console.error('Error fetching zones:', error);
      return [];
    }
  },

  createZone: async (zoneData) => {
    try {
      const backendFormat = transformZoneToBackend(zoneData);
      const response = await api.post('/geofence', backendFormat);
      return transformZoneFromBackend(response.data.geofence);
    } catch (error) {
      console.error('Error creating zone:', error);
      throw error;
    }
  },

  updateZone: async (id, zoneData) => {
    try {
      const backendFormat = transformZoneToBackend(zoneData);
      const response = await api.put(`/geofence/${id}`, backendFormat);
      return transformZoneFromBackend(response.data.geofence);
    } catch (error) {
      console.error('Error updating zone:', error);
      throw error;
    }
  },

  deleteZone: async (id) => {
    try {
      const response = await api.delete(`/geofence/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting zone:', error);
      throw error;
    }
  }
};

export default geofenceService;
