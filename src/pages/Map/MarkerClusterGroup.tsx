import React from 'react';
import MarkerClusterGroup from 'react-leaflet-cluster';

interface ClusterGroupProps {
  children: React.ReactNode;
}

/**
 * ClusterGroup — Wraps react-leaflet-cluster MarkerClusterGroup
 * with custom styling and performance options.
 */
const ClusterGroup = React.memo(({ children }: ClusterGroupProps) => {
  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      zoomToBoundsOnClick
      disableClusteringAtZoom={17}
      animate
      animateAddingMarkers={false}
      removeOutsideVisibleBounds
    >
      {children}
    </MarkerClusterGroup>
  );
});

ClusterGroup.displayName = 'ClusterGroup';

export default ClusterGroup;
