import React from 'react';
import { Cloud, Layers, Maximize, Pause, Play, Target } from 'lucide-react';
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

const MapControls = React.memo(({ isSimulation, isConnected, activeLayer, onLayerChange, recenterCenter, showWeather, onToggleWeather, onToggleSimulation }: MapControlsProps) => {
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
      <div className="absolute top-4 left-4 z-[1000] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-[720px]">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-white/92 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur-md dark:bg-[var(--card-bg)]/92">
          <LiveBadge isConnected={isConnected} isSimulation={isSimulation} />
          <Button
            onClick={onToggleSimulation}
            size="sm"
            variant={isSimulation ? 'primary' : 'ghost'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${isSimulation ? 'bg-[var(--brand-light)] text-[var(--brand-dark)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            {isSimulation ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isSimulation ? 'Pause' : 'Simulation'}
          </Button>
          <Button
            onClick={onToggleWeather}
            size="sm"
            variant={showWeather ? 'primary' : 'ghost'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium ${showWeather ? 'bg-[var(--brand-light)] text-[var(--brand-dark)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <Cloud className="h-3.5 w-3.5" />
            Météo
          </Button>
          <div className="hidden h-4 w-px bg-[var(--card-border)] sm:block" />
          <div className="flex gap-1">
            {Object.entries(TILE_LAYERS).map(([key, config]) => (
              <Button
                key={key}
                onClick={() => onLayerChange(key)}
                size="sm"
                variant={activeLayer === key ? 'primary' : 'ghost'}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${activeLayer === key
                  ? 'border border-[var(--brand-primary)] bg-[var(--brand-light)] text-[var(--brand-dark)]'
                  : 'border border-transparent bg-transparent text-[var(--text-muted)] hover:border-[var(--card-border)] hover:bg-[#fafaf8] hover:text-[var(--text-primary)]'
                  }`}
              >
                {config.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col items-end gap-2">
        <div className="rounded-2xl border border-[var(--card-border)] bg-white/90 p-2 shadow-lg shadow-black/5 backdrop-blur-md dark:bg-[var(--card-bg)]/90">
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-[var(--card-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">GIS</div>
            <Layers className="h-4 w-4 text-[var(--text-secondary)]" />
          </div>
        </div>
        <ControlButton onClick={handleRecenter} title="Recenter Map">
          <Target className="w-5 h-5" />
        </ControlButton>
        <ControlButton onClick={toggleFullscreen} title="Toggle Fullscreen">
          <Maximize className="w-5 h-5" />
        </ControlButton>
      </div>

      {/* Legend Overlay */}
      <div className="pointer-events-none absolute bottom-6 left-6 z-[1000] rounded-2xl border border-[var(--card-border)] bg-white/90 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur-md dark:bg-[var(--card-bg)]/90">
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--text-muted)]">Légende</h4>
        <div className="flex flex-wrap gap-2">
          <LegendItem color="bg-green-500" label="Sain & zone" />
          <LegendItem color="bg-red-500 animate-pulse" label="Sortie de zone" />
          <LegendItem color="bg-amber-500" label="Batterie faible" />
          <LegendItem color="bg-red-600" label="Critique" />
        </div>
      </div>
    </>
  );
});

const ControlButton = ({ children, onClick, title }: any) => (
  <Button
    onClick={onClick}
    title={title}
    variant="ghost"
    size="sm"
    className="border border-[var(--card-border)] bg-white/90 p-3 text-[var(--text-secondary)] backdrop-blur-md hover:border-[#c8dfd6] hover:text-[var(--brand-primary)] dark:bg-[var(--card-bg)]/90"
  >
    {children}
  </Button>
);

const LegendItem = ({ color, label }: any) => (
  <div className="flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-white/80 px-3 py-1.5 dark:bg-[var(--card-bg)]/80">
    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
  </div>
);

MapControls.displayName = 'MapControls';
ControlButton.displayName = 'ControlButton';
LegendItem.displayName = 'LegendItem';

export default MapControls;
