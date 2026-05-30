import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, Battery, ChevronRight, Cpu,
  Layers, Maximize2, MapPin, RefreshCw, Search, Shield,
  Thermometer, Wifi, WifiOff, X, ZoomIn, Focus,
  ArrowRight, Heart, Navigation
} from 'lucide-react';

import { useMqtt } from '../../contexts/MqttContext';
import { useRealtimePositions } from '../../hooks/useRealtimePositions';
import { useIoTStore } from '../../hooks/useIoTStore';
import geofenceService from '../../services/geofenceService';
import { IAnimal, IGeofenceZone } from '../../types';
import Button from '../../components/ui/Button';
import LiveBadge from '../../components/ui/LiveBadge';

const LazyRealTimeMap = React.lazy(() => import('./RealTimeMap'));

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = 'ALL' | 'SAFE' | 'OUT_OF_ZONE' | 'LOW_BATTERY' | 'CRITICAL';

const STATUS_CONFIG: Record<StatusFilter, { label: string; color: string; dot: string }> = {
  ALL: { label: 'Tous', color: 'text-gray-600', dot: '#6b7280' },
  SAFE: { label: 'Sains', color: 'text-green-600', dot: '#16a34a' },
  OUT_OF_ZONE: { label: 'Hors zone', color: 'text-amber-600', dot: '#f59e0b' },
  LOW_BATTERY: { label: 'Batterie', color: 'text-sky-600', dot: '#0284c7' },
  CRITICAL: { label: 'Critiques', color: 'text-red-600', dot: '#dc2626' },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapMonitor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const { isConnected, isSimulation } = useMqtt();
  const isOfflineData = useIoTStore(state => state.isOfflineData);
  const { animalsList, kpis } = useRealtimePositions();
  const history = useIoTStore(state => state.history);

  const [zones, setZones] = useState<IGeofenceZone[]>([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(focusId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tileLayer, setTileLayer] = useState<'street' | 'satellite' | 'dark'>('street');
  const mapFocusRef = useRef<((lat: number, lng: number, zoom?: number) => void) | null>(null);

  // ── Load geofence zones ──────────────────────────────────────────────────
  useEffect(() => {
    geofenceService.getZones().then(setZones).catch(() => { });
  }, []);

  // ── Focus on animal from ?focus= param ────────────────────────────────────
  useEffect(() => {
    if (!focusId || animalsList.length === 0) return;
    const target = animalsList.find(a => a.collar_id === focusId || a.id === focusId);
    if (target?.lat && target?.lng) {
      setSelectedAnimalId(focusId);
      setDetailOpen(true);
    }
  }, [focusId, animalsList]);

  // ── Open detail when animal selected ─────────────────────────────────────
  useEffect(() => {
    if (selectedAnimalId) setDetailOpen(true);
  }, [selectedAnimalId]);

  // ── Filtered animals ─────────────────────────────────────────────────────
  const filteredAnimals = useMemo(() => {
    return animalsList.filter(a => {
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const q = query.toLowerCase();
      const matchQuery = !q || (a.name || '').toLowerCase().includes(q)
        || (a.collar_id || '').toLowerCase().includes(q)
        || (a.breed || '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [animalsList, statusFilter, query]);

  const selectedAnimal = useMemo(
    () => animalsList.find(a => a.collar_id === selectedAnimalId || a.id === selectedAnimalId) || null,
    [animalsList, selectedAnimalId]
  );

  // ── Geofence handlers ─────────────────────────────────────────────────────
  const handleZoneCreated = useCallback((zone: IGeofenceZone) => {
    setZones(prev => [...prev, zone]);
    geofenceService.createZone(zone).catch(() => {
      toast.error('Impossible de sauvegarder la zone');
      setZones(prev => prev.filter(z => z.id !== zone.id));
    });
  }, []);

  const handleZoneDeleted = useCallback((ids: number[]) => {
    setZones(prev => prev.filter(z => !ids.includes(z.id)));
  }, []);

  const handleZoneEdited = useCallback((updated: IGeofenceZone[]) => {
    setZones(updated);
  }, []);

  const handleSelectAnimal = useCallback((id: string | null) => {
    setSelectedAnimalId(id);
    if (!id) setDetailOpen(false);
  }, []);

  // ── Status counts ─────────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    animalsList.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return counts;
  }, [animalsList]);

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-[#f7f6f3] dark:bg-gray-950 overflow-hidden">
      
      {/* ── Map area (Full Background) ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-sm">Chargement de la carte…</span>
            </div>
          </div>
        }>
          <LazyRealTimeMap
            animalsList={filteredAnimals}
            history={history}
            zones={zones}
            selectedAnimalId={selectedAnimalId}
            onSelectAnimal={handleSelectAnimal}
            onZoneCreated={handleZoneCreated}
            onZoneEdited={handleZoneEdited}
            onZoneDeleted={handleZoneDeleted}
            isSimulation={isSimulation}
            isConnected={isConnected}
            onViewportChange={() => { }}
            tileLayerOverride={tileLayer === 'street' ? 'streets' : tileLayer}
            imperativeRef={mapFocusRef}
          />
        </Suspense>

        {/* No animals overlay */}
        {animalsList.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2000]">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-gray-700 px-6 py-5 shadow-lg text-center max-w-xs">
              <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Aucun animal localisé</p>
              <p className="text-xs text-gray-400 mt-1">Démarrez la simulation ou connectez le broker MQTT</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Top Status Bar ─────────────────────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 pointer-events-none w-full max-w-4xl px-4">
        {/* Main Stats Bar */}
        <div className="flex items-center justify-between w-full px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50 pointer-events-auto transition-all">
          <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar">
            {/* Total */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-lg font-extrabold text-gray-900 dark:text-white">{animalsList.length}</span>
            </div>
            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
            
            {/* KPI Pills */}
            {(['SAFE', 'OUT_OF_ZONE', 'LOW_BATTERY', 'CRITICAL'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(prev => prev === s ? 'ALL' : s)}
                className={`flex flex-col items-start px-3 py-1.5 rounded-xl transition-all ${statusFilter === s
                  ? 'bg-gray-100 dark:bg-gray-800 shadow-inner'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shadow-sm" style={{ background: STATUS_CONFIG[s].dot }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{STATUS_CONFIG[s].label}</span>
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-white pl-3.5">{statusCounts[s] || 0}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pl-4 ml-4 border-l border-gray-200 dark:border-gray-700">
            <LiveBadge isConnected={isConnected} isSimulation={isSimulation} />
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className={`p-2.5 rounded-xl transition-all ${sidebarOpen ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              title="Liste des animaux"
            >
              <Layers className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Floating Sidebar ─────────────────────────────────────────────────────── */}
      <div className={`absolute top-24 left-4 bottom-4 z-[1000] w-80 flex flex-col bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 transition-all duration-300 transform ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un mouton..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/20">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            {filteredAnimals.length} animal{filteredAnimals.length > 1 ? 's' : ''} trouvé{filteredAnimals.length > 1 ? 's' : ''}
          </span>
          {statusFilter !== 'ALL' && (
            <button onClick={() => setStatusFilter('ALL')} className="text-xs text-primary font-medium hover:underline">
              Effacer le filtre
            </button>
          )}
        </div>

        {/* Animal list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredAnimals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MapPin className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Aucun résultat</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredAnimals.map(animal => (
                <SidebarAnimalRow
                  key={animal.collar_id}
                  animal={animal}
                  isSelected={selectedAnimalId === animal.collar_id}
                  onClick={() => {
                    setSelectedAnimalId(animal.collar_id);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Detail panel (right slide-in) ────────────────────────────────── */}
        <aside
          className={`flex-shrink-0 flex flex-col bg-white dark:bg-card-dark border-l border-gray-100 dark:border-gray-800 transition-all duration-300 overflow-hidden z-20 ${detailOpen && selectedAnimal ? 'w-72' : 'w-0'
            }`}
        >
          {detailOpen && selectedAnimal && (
            <AnimalDetailPanel
              animal={selectedAnimal}
              onClose={() => { setDetailOpen(false); setSelectedAnimalId(null); }}
              onNavigate={() => navigate(`/animals/${selectedAnimal.collar_id}`)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── AnimalDetailPanel ─────────────────────────────────────────────────────────
function AnimalDetailPanel({ animal, onClose, onNavigate }: {
  animal: IAnimal;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const statusColors: Record<string, string> = {
    SAFE: 'text-green-600 bg-green-50 dark:bg-green-500/10',
    OUT_OF_ZONE: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    LOW_BATTERY: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10',
    CRITICAL: 'text-red-600 bg-red-50 dark:bg-red-500/10',
  };

  const statusLabel: Record<string, string> = {
    SAFE: 'Sain',
    OUT_OF_ZONE: 'Hors zone',
    LOW_BATTERY: 'Batterie faible',
    CRITICAL: 'Critique',
  };

  const metrics = [
    { icon: <Battery className="w-3.5 h-3.5" />, label: 'Batterie', value: `${Math.round(animal.battery ?? 0)}%`, alert: (animal.battery ?? 100) < 20 },
    { icon: <Thermometer className="w-3.5 h-3.5" />, label: 'Température', value: typeof animal.temperature === 'number' ? `${animal.temperature.toFixed(1)}°C` : '—', alert: (animal.temperature ?? 0) > 40 },
    { icon: <Heart className="w-3.5 h-3.5" />, label: 'BPM', value: animal.heartRate ? `${animal.heartRate} bpm` : '—', alert: false },
    { icon: <Activity className="w-3.5 h-3.5" />, label: 'Activité', value: animal.activity_level != null ? `${Math.round(animal.activity_level * 100)}%` : '—', alert: false },
    { icon: <Navigation className="w-3.5 h-3.5" />, label: 'GPS', value: animal.lat && animal.lng ? `${animal.lat.toFixed(4)}, ${animal.lng.toFixed(4)}` : '—', alert: false },
    { icon: <Cpu className="w-3.5 h-3.5" />, label: 'Signal', value: animal.rssi ? `${animal.rssi} dBm` : 'N/D', alert: false },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{animal.name || animal.collar_id}</p>
          <p className="text-xs text-gray-400 truncate">{animal.breed || '—'} · #{animal.collar_id}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${statusColors[animal.status] || 'text-gray-600 bg-gray-100'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {statusLabel[animal.status] || animal.status}
        </span>
      </div>

      <div className="px-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {metrics.map(m => (
            <div key={m.label} className={`flex items-center justify-between py-2 px-3 rounded-lg ${m.alert ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
              <div className={`flex items-center gap-2 text-xs ${m.alert ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {m.icon}
                <span>{m.label}</span>
              </div>
              <span className={`text-xs font-semibold tabular-nums ${m.alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {m.value}
              </span>
            </div>
          ))}
        </div>

        {(animal as any).lastUpdate && (
          <p className="mt-3 text-xs text-gray-400 text-center">
            Mis à jour {new Date((animal as any).lastUpdate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          Voir le profil complet <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── SidebarAnimalRow ─────────────────────────────────────────────────────────
function SidebarAnimalRow({ animal, isSelected, onClick }: {
  animal: IAnimal;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dotColor = {
    SAFE: '#16a34a',
    OUT_OF_ZONE: '#f59e0b',
    LOW_BATTERY: '#0284c7',
    CRITICAL: '#dc2626',
  }[animal.status] || '#6b7280';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all rounded-xl ${isSelected ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
        }`}
    >
      <span className="relative flex w-2.5 h-2.5 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-30" style={{ backgroundColor: dotColor }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{animal.name || animal.collar_id}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider truncate">{animal.breed || '—'}</p>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
            <Battery className="w-3 h-3" /> {(animal.battery ?? 0).toFixed(0)}%
          </p>
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'text-primary translate-x-1' : 'text-gray-300'}`} />
    </button>
  );
}
