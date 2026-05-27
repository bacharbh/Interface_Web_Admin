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

  useEffect(() => {
    const mapInst = map as L.Map & {
      pm?: {
        addControls: (options: {
          position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
          drawPolygon?: boolean;
          editMode?: boolean;
          dragMode?: boolean;
          cutPolygon?: boolean;
          drawMarker?: boolean;
          drawCircle?: boolean;
          drawRectangle?: boolean;
          drawPolyline?: boolean;
        }) => void;
      };
    };

    const extractCoords = (layer: L.Layer): [number, number][] | null => {
      const toGeoJSON = (layer as L.Layer & { toGeoJSON: () => GeoJSON.Feature }).toGeoJSON;
      if (!toGeoJSON) return null;
      const geo = toGeoJSON();
      const coordinates = (geo.geometry as GeoJSON.Polygon | undefined)?.coordinates?.[0];
      if (!Array.isArray(coordinates) || coordinates.length < 3) return null;
      return coordinates.map(([lng, lat]) => [lat, lng]);
    };

    const onCreate = (event: { layer: L.Layer }) => {
      const coords = extractCoords(event.layer);
      if (!coords) {
        event.layer.remove();
        return;
      }

      onZoneCreated({
        id: Date.now(),
        name: 'Nouvelle zone',
        coords,
        color: DEFAULT_ZONE_COLOR,
        type: DEFAULT_ZONE_TYPE,
      });
    };

    const onEdit = (event: { layers: { eachLayer: (callback: (layer: L.Layer) => void) => void } }) => {
      const updatedZones: EditableZone[] = [];

      event.layers.eachLayer((layer) => {
        const coords = extractCoords(layer);
        if (!coords) return;

        const zoneId = Number((layer as L.Layer & { options?: { id?: number } }).options?.id);
        if (!zoneId) return;

        updatedZones.push({
          id: zoneId,
          name: 'Zone',
          coords,
          color: DEFAULT_ZONE_COLOR,
          type: DEFAULT_ZONE_TYPE,
        });
      });

      if (updatedZones.length > 0) {
        onZoneEdited(updatedZones);
      }
    };

    const onRemove = (event: { layers: { eachLayer: (callback: (layer: L.Layer) => void) => void } }) => {
      const removedIds: number[] = [];

      event.layers.eachLayer((layer) => {
        const zoneId = Number((layer as L.Layer & { options?: { id?: number } }).options?.id);
        if (zoneId) removedIds.push(zoneId);
      });

      if (removedIds.length > 0) {
        onZoneDeleted(removedIds);
      }
    };

    let cancelled = false;
    let rafId = 0;
    let cleanupListeners: (() => void) | undefined;

    const attachControls = () => {
      if (cancelled) return;

      if (!mapInst.pm) {
        rafId = window.requestAnimationFrame(attachControls);
        return;
      }

      try {
        mapInst.pm.addControls({
          position: 'topright',
          drawPolygon: true,
          editMode: true,
          dragMode: false,
          cutPolygon: false,
          drawMarker: false,
          drawCircle: false,
          drawRectangle: false,
          drawPolyline: false,
        });
      } catch {
        return;
      }

      mapInst.on('pm:create' as any, onCreate as any);
      mapInst.on('pm:edit' as any, onEdit as any);
      mapInst.on('pm:remove' as any, onRemove as any);

      cleanupListeners = () => {
        mapInst.off('pm:create' as any, onCreate as any);
        mapInst.off('pm:edit' as any, onEdit as any);
        mapInst.off('pm:remove' as any, onRemove as any);
      };
    };

    rafId = window.requestAnimationFrame(attachControls);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      cleanupListeners?.();
    };
  }, [map, onZoneCreated, onZoneEdited, onZoneDeleted]);

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
