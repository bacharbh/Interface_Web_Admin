import React from 'react';
import { Maximize, Target, Sun, Layers } from 'lucide-react';
import { useMap } from 'react-leaflet';
import LiveBadge from '../../components/ui/LiveBadge';
import Button from '../../components/ui/Button';

export const TILE_LAYERS: Record<string, any> = {
  street: {
    name: 'Rues',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    backupUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  dark: {
    name: 'Sombre',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
};

interface MapControlsProps {
  isSimulation: boolean;
  isConnected: boolean;
  activeLayer: string;
  onLayerChange: (layer: string) => void;
  recenterCenter: [number, number];
  showWeather: boolean;
  onToggleWeather: () => void;
  onToggleSimulation: () => void;
}

const MapControls = React.memo(({ isSimulation, isConnected, activeLayer, onLayerChange, recenterCenter, showWeather, onToggleWeather }: MapControlsProps) => {
  const [showLegend, setShowLegend] = React.useState(true);

  const handleCenterOnUser = () => {
    // Dispatch a custom event that UserLocationMarker listens for
    window.dispatchEvent(new Event('centerOnUser'));
  };

  const toggleLegend = () => {
    setShowLegend(prev => !prev);
  };
  const map = useMap();

  const handleRecenter = () => {
    map.setView(recenterCenter, 14, { animate: true });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <>
      {/* Top Left: Layer controls & Live Badge */}
      <div className="absolute top-4 left-4 z-[1000] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-[720px]">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--card-border)] bg-white px-3 py-2 shadow-lg shadow-black/5 dark:bg-[var(--card-bg)]">
          <LiveBadge isConnected={isConnected} isSimulation={isSimulation} />
          
          <div className="hidden h-4 w-px bg-[var(--card-border)] sm:block" />
          
          <div className="flex gap-1">
            {Object.entries(TILE_LAYERS).map(([key, config]) => (
              <Button
                key={key}
                onClick={() => onLayerChange(key)}
                size="sm"
                variant={activeLayer === key ? 'primary' : 'ghost'}
                className={`uppercase tracking-wider rounded-full px-4 py-1.5 text-[11px] font-bold transition-colors ${
                  activeLayer === key
                    ? 'bg-[#00A96E] text-white hover:bg-[#009662]'
                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {config.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Right: Weather toggle */}
      <div className="absolute top-4 right-4 z-[1000]">
          <Button
            onClick={onToggleWeather}
            size="sm"
            variant={showWeather ? 'primary' : 'ghost'}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold border border-[var(--card-border)] bg-white shadow-lg shadow-black/5 dark:bg-[var(--card-bg)] ${
              showWeather ? 'text-[#00A96E]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sun className="h-4 w-4" />
            Météo
          </Button>
          {/* "Ma position" button to center map on user */}
          <Button
            onClick={handleCenterOnUser}
            size="sm"
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold border border-[var(--card-border)] bg-white shadow-lg shadow-black/5 dark:bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-primary"
          >
            <Target className="h-4 w-4" />
            Ma position
          </Button>
      </div>

      {/* Bottom Right: Actions */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col items-center gap-3">
        <button
          onClick={handleRecenter}
          title="Recenter Map"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-[var(--card-border)] bg-white shadow-sm hover:bg-gray-50 text-[#6b7280] hover:text-[#111827] transition-colors dark:bg-[var(--card-bg)] dark:hover:bg-gray-800"
        >
          <Target className="w-5 h-5" />
        </button>
        
        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-[var(--card-border)] bg-white shadow-sm hover:bg-gray-50 text-[#6b7280] hover:text-[#111827] transition-colors dark:bg-[var(--card-bg)] dark:hover:bg-gray-800"
        >
          <Maximize className="w-5 h-5" />
        </button>

        <button
          title="Layers"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-[var(--card-border)] bg-white shadow-sm hover:bg-gray-50 text-[#6b7280] hover:text-[#111827] transition-colors dark:bg-[var(--card-bg)] dark:hover:bg-gray-800"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Left: Legend */}
        {/* Legend with toggle */}
        <div className="absolute bottom-6 left-6 z-[1000] min-w-[150px]">
          <Button
            onClick={toggleLegend}
            size="sm"
            variant="ghost"
            className="mb-2 flex items-center gap-1.5 px-2 py-1 bg-white/90 dark:bg-card-dark/95 backdrop-blur-md rounded-md border border-[var(--card-border)] shadow-sm"
          >
            {showLegend ? 'Cacher légende' : 'Afficher légende'}
          </Button>
          {showLegend && (
            <div className="rounded-[14px] border border-[var(--card-border)] bg-white px-4 py-4 shadow-lg shadow-black/5 dark:bg-[var(--card-bg)]">
              <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">Légende</h4>
              <div className="flex flex-col gap-3">
                <LegendItem color="bg-[#00A96E]" label="Sain & Zone" />
                <LegendItem color="bg-[#EF4444]" label="Sortie de Zone" />
                <LegendItem color="bg-[#F59E0B]" label="Batterie Faible" />
                <LegendItem color="bg-[#991B1B]" label="État Critique" />
              </div>
            </div>
          )}
        </div>
    </>
  );
});



const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2.5">
    <div className={`w-[9px] h-[9px] rounded-full ${color}`} />
    <span className="text-[12px] font-medium text-[#4b5563] dark:text-gray-300">{label}</span>
  </div>
);

MapControls.displayName = 'MapControls';
LegendItem.displayName = 'LegendItem';

export default MapControls;

