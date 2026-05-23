import React from 'react';
import { FeatureGroup, Polygon } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { IGeofenceZone } from '../../types';

const DEFAULT_ZONE_COLOR = '#16a34a';
const DEFAULT_ZONE_TYPE: NonNullable<IGeofenceZone['type']> = 'exclusion';

type EditableZone = IGeofenceZone;

interface GeofenceLayerProps {
  zones: EditableZone[];
  onZoneCreated: (zone: EditableZone) => void;
  onZoneEdited: (zones: EditableZone[]) => void;
  onZoneDeleted: (zoneIds: number[]) => void;
  breachedZoneIds: number[];
}

const GeofenceLayer = ({
  zones,
  onZoneCreated,
  onZoneEdited,
  onZoneDeleted,
  breachedZoneIds
}: GeofenceLayerProps) => {

  const extractCoordinates = (layer: any): [number, number][] | null => {
    const geoJson = layer?.toGeoJSON?.();
    const ring = geoJson?.geometry?.coordinates?.[0];

    if (!Array.isArray(ring) || ring.length < 3) {
      return null;
    }

    return ring.map(([lng, lat]: [number, number]) => [lat, lng]);
  };

  const _onCreated = (e: any) => {
    const { layer } = e;
    const coords = extractCoordinates(layer);

    if (!coords) {
      layer.remove();
      return;
    }

    layer.remove();

    onZoneCreated({
      id: Date.now(),
      name: 'Nouvelle zone',
      coords,
      color: DEFAULT_ZONE_COLOR,
      type: DEFAULT_ZONE_TYPE,
    });
  };

  const _onEdited = (e: any) => {
    const updatedZones = zones.map((zone) => ({ ...zone }));

    e.layers.eachLayer((layer: any) => {
      const id = Number(layer?.options?.id);
      const coords = extractCoordinates(layer);

      if (!id || !coords) {
        return;
      }

      const zoneIdx = updatedZones.findIndex((zone) => zone.id === id);
      if (zoneIdx !== -1) {
        updatedZones[zoneIdx] = {
          ...updatedZones[zoneIdx],
          coords,
        };
      }
    });

    onZoneEdited(updatedZones);
  };

  const _onDeleted = (e: any) => {
    const deletedIds: number[] = [];

    e.layers.eachLayer((layer: any) => {
      const id = Number(layer?.options?.id);
      if (id) {
        deletedIds.push(id);
      }
    });

    if (deletedIds.length > 0) {
      onZoneDeleted(deletedIds);
    }
  };

  return (
    <FeatureGroup>
      <EditControl
        position="topright"
        onCreated={_onCreated}
        onEdited={_onEdited}
        onDeleted={_onDeleted}
        draw={{
          rectangle: false,
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
          polygon: {
            allowIntersection: false,
            drawError: {
              color: '#e1e1e1',
              message: '<strong>Erreur:<strong> Intersections non autorisées!',
            },
            showArea: true,
            shapeOptions: {
              color: DEFAULT_ZONE_COLOR,
              fillColor: DEFAULT_ZONE_COLOR,
              fillOpacity: 0.12,
              weight: 2,
            },
          },
        }}
        edit={{
          edit: {
            selectedPathOptions: {
              color: '#16a34a',
              fillOpacity: 0.2,
            },
          },
          remove: true
        }}
      />
      {zones.map((zone) => {
        const isBreached = breachedZoneIds.includes(zone.id);
        const color = zone.color || DEFAULT_ZONE_COLOR;
        return (
          <Polygon
            key={zone.id}
            positions={zone.coords as any}
            // Passing ID to leaflet option so we can identify it during Edit/Delete events
            {...({ id: zone.id } as any)}
            pathOptions={{
              color: isBreached ? '#ef4444' : color,
              fillColor: isBreached ? '#ef4444' : color,
              fillOpacity: isBreached ? 0.3 : 0.1,
              weight: isBreached ? 4 : 2,
              dashArray: isBreached ? '10, 10' : undefined,
            }}
          />
        );
      })}
    </FeatureGroup>
  );
};

GeofenceLayer.displayName = 'GeofenceLayer';

export default GeofenceLayer;
