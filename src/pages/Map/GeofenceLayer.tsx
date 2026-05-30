import React, { useEffect } from 'react';
import { FeatureGroup, Polygon, Tooltip, useMap } from 'react-leaflet';
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
  const map = useMap();



  return (
    <FeatureGroup>
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
              fillOpacity: isBreached ? 0.18 : 0.08,
              weight: isBreached ? 3.5 : 2,
              dashArray: isBreached ? '8, 8' : undefined,
            }}
          >
            <Tooltip
              permanent
              direction="center"
              opacity={1}
              className="geofence-label"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{zone.name}</span>
            </Tooltip>
          </Polygon>
        );
      })}
    </FeatureGroup>
  );
};

GeofenceLayer.displayName = 'GeofenceLayer';

export default GeofenceLayer;
