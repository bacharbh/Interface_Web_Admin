import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icons for Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MiniGPSMapProps {
    animalId: string;
    gpsPoints?: Array<{ lat: number; lng: number; timestamp: string }>;
}

const MiniGPSMap: React.FC<MiniGPSMapProps> = ({
    animalId,
    gpsPoints = [
        // Mock data: last 24 hours
        { lat: 45.1885, lng: 5.7245, timestamp: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1887, lng: 5.7247, timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1890, lng: 5.7250, timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1893, lng: 5.7252, timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1895, lng: 5.7255, timestamp: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1898, lng: 5.7258, timestamp: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1900, lng: 5.7260, timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1902, lng: 5.7262, timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1905, lng: 5.7265, timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1908, lng: 5.7268, timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1910, lng: 5.7270, timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1912, lng: 5.7272, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1915, lng: 5.7275, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        { lat: 45.1918, lng: 5.7278, timestamp: new Date().toISOString() }, // Current position
    ],
}) => {
    // Calculate center and bounds
    const bounds = useMemo(() => {
        if (gpsPoints.length === 0) {
            return { center: [45.1885, 5.7245] as [number, number], bounds: null };
        }

        const lats = gpsPoints.map(p => p.lat);
        const lngs = gpsPoints.map(p => p.lng);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const center = [
            (minLat + maxLat) / 2,
            (minLng + maxLng) / 2,
        ] as [number, number];

        return {
            center,
            bounds: [[minLat - 0.002, minLng - 0.002], [maxLat + 0.002, maxLng + 0.002]] as [[number, number], [number, number]],
        };
    }, [gpsPoints]);

    // Create polyline path
    const polylinePath = useMemo(() => {
        return gpsPoints.map(p => [p.lat, p.lng] as [number, number]);
    }, [gpsPoints]);

    const currentPosition = gpsPoints[gpsPoints.length - 1];

    return (
        <div className="w-full h-[140px] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <MapContainer
                center={bounds.center}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                bounds={bounds.bounds || undefined}
                boundsOptions={{ padding: [50, 50] }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                    maxZoom={19}
                />

                {/* Trace line (last 24 hours) */}
                {polylinePath.length > 1 && (
                    <Polyline
                        positions={polylinePath}
                        color="#10B981"
                        weight={3}
                        opacity={0.6}
                        dashArray="5, 10"
                    />
                )}

                {/* Historical points (fading) */}
                {gpsPoints.slice(0, -1).map((point, index) => (
                    <CircleMarker
                        key={`historical-${index}`}
                        center={[point.lat, point.lng]}
                        radius={3}
                        fillColor="#10B981"
                        color="white"
                        weight={1}
                        opacity={0.3 + (index / gpsPoints.length) * 0.4}
                        fillOpacity={0.3 + (index / gpsPoints.length) * 0.4}
                    />
                ))}

                {/* Current position (highlighted) */}
                {currentPosition && (
                    <Marker
                        position={[currentPosition.lat, currentPosition.lng]}
                        icon={L.icon({
                            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxMiIgZmlsbD0iIzEwQjk4MSIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI4IiBmaWxsPSJ3aGl0ZSIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSI0IiBmaWxsPSIjMTBCOTgxIi8+Cjwvc3ZnPg==',
                            iconSize: [32, 32],
                            iconAnchor: [16, 16],
                            popupAnchor: [0, -16],
                        })}
                    >
                        <Popup>
                            <div className="text-xs">
                                <p className="font-semibold">Position actuelle</p>
                                <p className="text-gray-600">{currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}</p>
                                <p className="text-gray-500 text-[10px]">
                                    {new Date(currentPosition.timestamp).toLocaleTimeString('fr-FR')}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
};

export default MiniGPSMap;
