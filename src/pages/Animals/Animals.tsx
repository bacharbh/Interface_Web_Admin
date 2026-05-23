import React, { useState, useMemo, useDeferredValue, useEffect, useRef, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import {
  Activity, Search, ChevronUp, ChevronDown,
  MapPin, Battery, Thermometer,
  AlertTriangle, CheckCircle2, Zap,
  Download, X, Wind, Radio, Clock, Heart, Check
} from 'lucide-react';
import { useIoTStore } from '../../hooks/useIoTStore';
import { HEALTH_LABEL_BORDERS, HEALTH_LABEL_COLORS, getHealthLabelText, scoreAnimalHealth } from '../../ai/healthScoring';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { IAnimal, HealthStatus } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────
interface EnrichedAnimal extends IAnimal {
  healthScore: {
    score: number;
    label: string;
    mostConcerningMetric: {
      label: string;
      score: number;
    };
    recentAlertCount: number;
  };
}

interface ItemData {
  animals: EnrichedAnimal[];
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAnimal: (animal: EnrichedAnimal) => void;
  onNavigateAnimal: (id: string) => void;
}

// ─── Health badge helper ───────────────────────────────────────────────────
const healthBadge = (health: HealthStatus) => {
  const map: Record<HealthStatus, string> = {
    Good: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20',
    Warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    Critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  };
  return map[health] || 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
};

const statusDot = (health: HealthStatus) => {
  if (health === 'Critical') return 'bg-red-500 animate-pulse';
  if (health === 'Warning') return 'bg-amber-500';
  return 'bg-green-500';
};

const GRID_TEMPLATE = '44px minmax(220px, 2.1fr) minmax(140px, 1.1fr) minmax(120px, 1fr) minmax(140px, 1fr) minmax(160px, 1.2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) 128px';
const LIST_HEADER_HEIGHT = 52;
const LIST_FOOTER_HEIGHT = 52;
const LIST_ROW_HEIGHT = 96;
const LIST_MIN_WIDTH = 1292;

function useElementSize(): [React.MutableRefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

const AnimalListItem = memo(function AnimalListItem({ index, style, data }: ListChildComponentProps<ItemData>) {
  const animal = data.animals[index];

  if (!animal) return null;

  const selected = data.selectedIds.has(animal.collar_id);
  const battery = animal.battery ?? 0;
  const temperature = animal.temperature ?? 0;
  const healthScore = animal.healthScore ?? { score: 0, label: 'critique', mostConcerningMetric: { label: '', score: 0 }, recentAlertCount: 0 };

  return (
    <div style={style} className="px-0.5 py-1">
      <div className="h-full overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white transition-colors hover:border-[#c8dfd6] dark:bg-[var(--card-bg)]">
        <div
          className="h-full grid items-center cursor-pointer"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
          onClick={() => data.onSelectAnimal(animal)}
        >
          <div className="pl-3 flex justify-center" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => data.onToggleSelection(animal.collar_id)}
              className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${selected
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
                : 'border-[var(--card-border)] hover:border-[var(--brand-primary)]'
                }`}
            >
              {selected && <Check className="h-3 w-3 text-white" />}
            </button>
          </div>

          <div className="px-5 py-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--card-border)] bg-[var(--brand-light)] text-[16px]">🐑</div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[var(--card-bg)] ${statusDot(animal.health)}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{animal.name}</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{animal.collar_id}</p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 min-w-0">
            <p className="truncate text-[12px] font-medium text-[var(--text-secondary)]">{animal.breed}</p>
          </div>

          <div className="px-5 py-4">
            <span className="whitespace-nowrap rounded-[8px] border border-[var(--card-border)] bg-[#fafaf8] px-2 py-1 font-mono text-[11px] font-medium text-[var(--brand-dark)]">{animal.collar_id}</span>
          </div>

          <div className="px-5 py-4">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${healthBadge(animal.health)}`}>
              {animal.health.toLowerCase()}
            </span>
          </div>

          <div className="px-5 py-4">
            <div className={`rounded-[8px] border px-3 py-2 ${HEALTH_LABEL_BORDERS[healthScore.label as keyof typeof HEALTH_LABEL_BORDERS]} ${HEALTH_LABEL_COLORS[healthScore.label as keyof typeof HEALTH_LABEL_COLORS]}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium tabular-nums">{healthScore.score}/100</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] opacity-80">{getHealthLabelText(healthScore.label as any)}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current/20">
                  <span className="text-[10px] font-medium">{healthScore.mostConcerningMetric?.score ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 min-w-[70px]">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[var(--card-border)]">
                <div
                  className={`h-full rounded-full transition-all ${battery < 20 ? 'bg-red-500' : battery < 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${battery}%` }}
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{battery}%</span>
            </div>
          </div>

          <div className="px-5 py-4">
            <span className={`text-[12px] font-medium tabular-nums ${temperature > 40 ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}>
              {temperature.toFixed(1)}°
            </span>
          </div>

          <div className="px-5 py-4">
            <span className="text-[11px] font-medium text-[var(--text-muted)]">{animal.lastUpdate || '—'}</span>
          </div>

          <div className="px-5 py-4" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => data.onNavigateAnimal(animal.collar_id)} className="px-3 py-1.5 text-[12px]">
              Détails →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

interface VirtualizedListProps {
  animals: EnrichedAnimal[];
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAnimal: (animal: EnrichedAnimal) => void;
  onNavigateAnimal: (id: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onToggleSort: (col: string) => void;
}

const VirtualizedAnimalsList = memo(function VirtualizedAnimalsList({
  animals, selectedIds, onToggleSelection, onSelectAnimal, onNavigateAnimal, sortBy, sortDir, onToggleSort
}: VirtualizedListProps) {
  const [frameRef, frameSize] = useElementSize();
  const [visibleRange, setVisibleRange] = useState({ start: 0, stop: 0 });

  const itemData = useMemo<ItemData>(() => ({
    animals,
    selectedIds,
    onToggleSelection,
    onSelectAnimal,
    onNavigateAnimal,
  }), [animals, selectedIds, onToggleSelection, onSelectAnimal, onNavigateAnimal]);

  const width = Math.max(frameSize.width, LIST_MIN_WIDTH);
  const height = Math.max(frameSize.height, 360);

  const headerColumns = [
    { key: 'name', label: 'Animal' },
    { key: 'breed', label: 'Race' },
    { key: 'collar_id', label: 'Collier' },
    { key: 'health', label: 'Santé' },
    { key: 'healthScore', label: 'Score IA' },
    { key: 'battery', label: 'Batterie' },
    { key: 'temperature', label: 'Temp.' },
    { key: 'lastUpdate', label: 'Mise à jour' },
  ];

  const SortIcon = ({ col }: { col: string }) => sortBy === col
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronUp className="w-3 h-3 opacity-20" />;

  return (
    <div ref={frameRef} className="h-[70vh] min-h-[420px] max-h-[760px] flex flex-col">
      <div className="overflow-x-auto flex-1">
        <div style={{ minWidth: LIST_MIN_WIDTH }} className="h-full flex flex-col">
          <div className="grid items-center border-b border-gray-50 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30 text-left label-xs font-black tracking-wider" style={{ gridTemplateColumns: GRID_TEMPLATE, minHeight: LIST_HEADER_HEIGHT }}>
            <div className="pl-3 flex justify-center">
              <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800" />
            </div>
            {headerColumns.map(col => (
              <button
                key={col.key}
                type="button"
                onClick={() => onToggleSort(col.key)}
                className="px-5 py-3.5 text-left label-xs font-black tracking-wider cursor-pointer hover:text-primary transition-colors select-none"
              >
                <span className="flex items-center gap-1">
                  {col.label} <SortIcon col={col.key} />
                </span>
              </button>
            ))}
            <div className="px-5 py-3.5 text-left label-xs font-black tracking-wider">Actions</div>
          </div>

          <div className="flex-1">
            {animals.length === 0 ? (
              <div className="text-center py-24 flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center text-4xl animate-pulse">🐑</div>
                <p className="label-sm font-black text-gray-400 tracking-widest">Aucun animal ne correspond aux filtres actifs.</p>
                <p className="text-gray-400 text-xs">Ajustez la recherche ou les filtres pour afficher des résultats.</p>
              </div>
            ) : (
              <List
                height={Math.max(height - LIST_HEADER_HEIGHT - LIST_FOOTER_HEIGHT, 260)}
                itemCount={animals.length}
                itemSize={LIST_ROW_HEIGHT}
                width={width}
                itemData={itemData}
                itemKey={(index, data) => data.animals[index].collar_id}
                overscanCount={6}
                onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
                  setVisibleRange({ start: visibleStartIndex, stop: visibleStopIndex });
                }}
              >
                {AnimalListItem}
              </List>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-3.5 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-card-dark">
        <p className="label-xs font-bold">
          Affichage {animals.length === 0 ? 0 : visibleRange.start + 1}–{Math.min(visibleRange.stop + 1, animals.length)} sur {animals.length} animaux
        </p>
        <p className="label-xs text-gray-400 font-medium">
          Liste virtualisée, seules les lignes visibles sont rendues
        </p>
      </div>
    </div>
  );
});

// ─── Slide-over Detail Panel ───────────────────────────────────────────────
interface DetailPanelProps {
  animal: EnrichedAnimal | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

function AnimalDetailPanel({ animal, onClose, onNavigate }: DetailPanelProps) {
  if (!animal) return null;

  const battery = animal.battery ?? 0;
  const temperature = animal.temperature ?? 0;
  const healthScore = animal.healthScore ?? { score: 0, label: 'critique', mostConcerningMetric: { label: '', score: 0 }, recentAlertCount: 0 };
  const batteryColor = battery < 20 ? 'text-red-500' : battery < 50 ? 'text-amber-500' : 'text-green-500';
  const batteryBg = battery < 20 ? 'bg-red-500' : battery < 50 ? 'bg-amber-500' : 'bg-green-500';
  const latitude = typeof animal.lat === 'number' ? animal.lat : null;
  const longitude = typeof animal.lng === 'number' ? animal.lng : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">🐑</div>
            <div>
              <h3 className="title-sm text-gray-900 dark:text-white">{animal.name}</h3>
              <p className="label-xs">{animal.collar_id} · {animal.breed}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onNavigate(`/agenda?prefill=${animal.collar_id}`); }}>Planifier une visite</Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-2"><X className="w-5 h-5 text-gray-500" /></Button>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`mx-6 mt-6 p-4 rounded-2xl border flex items-center gap-3 ${healthBadge(animal.health)}`}>
          <Heart className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="label-sm font-black">État de santé : {animal.health?.toLowerCase?.() ?? '—'}</p>
            <p className="label-xs mt-0.5 font-normal opacity-75">
              {animal.health === 'Critical' ? 'Attention requise immédiatement' :
                animal.health === 'Warning' ? 'Surveillance recommandée' : 'Animal en bonne condition'}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="p-6 space-y-4">
          <p className="label-xs">Métriques temps réel</p>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/40`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Battery className={`w-4 h-4 ${batteryColor}`} />
                <p className="label-xs">Batterie</p>
              </div>
              <p className="title-md tabular-nums text-gray-900 dark:text-white">{battery}%</p>
              <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full ${batteryBg}`} style={{ width: `${battery}%` }} />
              </div>
            </div>
            <div className={`p-3 rounded-xl border ${temperature > 40 ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/40'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Thermometer className="w-4 h-4 text-orange-500" />
                <p className="label-xs">Température</p>
              </div>
              <p className={`title-md tabular-nums ${temperature > 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{temperature}°C</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Wind className="w-4 h-4 text-blue-500" />
                <p className="label-xs">Vitesse</p>
              </div>
              <p className="title-md tabular-nums text-gray-900 dark:text-white">{animal.speed ?? 0} km/h</p>
            </div>
            <div className={`p-3 rounded-xl border ${animal.rssi && animal.rssi < -85 ? 'border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/40'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Radio className="w-4 h-4 text-purple-500" />
                <p className="label-xs">Signal RSSI</p>
              </div>
              <p className={`title-md tabular-nums ${animal.rssi && animal.rssi < -85 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{animal.rssi ?? '—'} dBm</p>
            </div>
          </div>

          {/* GPS */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-2">
            <p className="label-xs flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary" /> Position GPS
            </p>
            <div className="font-mono label-sm text-gray-800 dark:text-gray-200 font-bold">
              {latitude !== null && longitude !== null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'GPS indisponible'}
            </div>
            <div className="flex items-center gap-2 label-xs text-gray-400 font-bold">
              <Clock className="w-3 h-3" />
              Mis à jour : {animal.lastUpdate || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function Animals() {
  // Select devices and alerts separately to avoid returning a new object
  // on every render which can trigger subscription infinite loops.
  const devices = useIoTStore(state => state.devices);
  const alerts = useIoTStore(state => state.alerts);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHealth, setFilterHealth] = useState<HealthStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState('healthScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedAnimal, setSelectedAnimal] = useState<EnrichedAnimal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const animals = useMemo<EnrichedAnimal[]>(() => {
    const list = Object.values(devices || {}).map((animal) => {
      try {
        return {
          ...animal,
          healthScore: scoreAnimalHealth(animal, alerts),
        };
      } catch (err) {
        // Defensive: log and provide a fallback healthScore so rendering doesn't crash
        // This helps capture problematic device payloads while we debug in dev.
        // eslint-disable-next-line no-console
        console.warn('scoreAnimalHealth failed for', animal?.collar_id || animal?.name, err);
        return {
          ...animal,
          healthScore: { score: 0, label: 'critique', mostConcerningMetric: { label: '', score: 0 }, recentAlertCount: 0 },
        };
      }
    });

    // Diagnostics: detect malformed animals early and warn in dev console
    try {
      const malformed = list.filter(a => !a || !a.collar_id || typeof a.lat !== 'number' || typeof a.lng !== 'number');
      if (malformed.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('Animals list contains malformed entries', malformed.map(m => ({ collar_id: m?.collar_id, name: m?.name, lat: m?.lat, lng: m?.lng })));
      }
    } catch (e) {
      // ignore diagnostics failures
    }

    return [...list].sort((a, b) => {
      let av: any = sortBy === 'healthScore' ? a.healthScore.score : (a as any)[sortBy];
      let bv: any = sortBy === 'healthScore' ? b.healthScore.score : (b as any)[sortBy];

      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();

      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      return 0;
    });
  }, [alerts, devices, sortBy, sortDir]);

  const filtered = useMemo(() => {
    let list = animals;

    if (deferredSearchTerm) {
      const q = deferredSearchTerm.toLowerCase();
      list = list.filter((animal) =>
        animal.name?.toLowerCase().includes(q) ||
        animal.collar_id?.toLowerCase().includes(q) ||
        animal.breed?.toLowerCase().includes(q)
      );
    }

    if (filterHealth !== 'ALL') {
      list = list.filter((animal) => animal.health === filterHealth);
    }

    return list;
  }, [animals, deferredSearchTerm, filterHealth]);

  const toggleSort = useCallback((col: string) => {
    if (sortBy === col) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }, [sortBy]);

  const toggleSelection = useCallback((animalId: string) => {
    setSelected((prev) => {
      if (prev.includes(animalId)) return prev.filter((id) => id !== animalId);
      if (prev.length >= 4) return prev;
      return [...prev, animalId];
    });
  }, []);

  const openAnimalDetail = useCallback((animal: EnrichedAnimal) => {
    setSelectedAnimal(animal);
  }, []);

  const navigateToAnimal = useCallback((animalId: string) => {
    navigate(`/animals/${animalId}`);
  }, [navigate]);

  const goToCompare = useCallback(() => {
    if (selected.length < 2) return;
    navigate(`/compare?ids=${selected.join(',')}`);
  }, [navigate, selected]);

  const exportToCSV = useCallback(() => {
    const rows = filtered.map((animal) => [
      animal.name,
      animal.breed,
      animal.collar_id,
      animal.health,
      animal.battery,
      animal.temperature?.toFixed(1),
      animal.lastUpdate,
      animal.lat?.toFixed(5),
      animal.lng?.toFixed(5),
    ]);

    const header = ['Animal', 'Race', 'Collier ID', 'Santé', 'Batterie (%)', 'Température (°C)', 'Dernière Mise À Jour', 'Latitude', 'Longitude'];
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `animaux_export_${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const selectedIdSet = useMemo(() => new Set(selected), [selected]);
  const isEmpty = filtered.length === 0;

  const kpis = useMemo(() => ({
    total: animals.length,
    good: animals.filter((animal) => animal.health === 'Good').length,
    warning: animals.filter((animal) => animal.health === 'Warning').length,
    critical: animals.filter((animal) => animal.health === 'Critical').length,
  }), [animals]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      {selectedAnimal && (
        <AnimalDetailPanel animal={selectedAnimal} onClose={() => setSelectedAnimal(null)} onNavigate={navigate} />
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-[28px] font-medium tracking-[-0.02em] text-[var(--text-primary)]">
            <Activity className="h-8 w-8 text-[var(--brand-primary)]" /> Gestion du troupeau
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Surveillez chaque animal en temps réel grâce aux colliers GPS.</p>
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--card-border)] bg-white px-4 py-2 text-[11px] text-[var(--text-secondary)] dark:bg-[var(--card-bg)]">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          {animals.length} animaux actifs
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: kpis.total, color: 'text-[var(--text-primary)]' },
          { label: 'En bonne santé', value: kpis.good, color: 'text-green-600 dark:text-green-400' },
          { label: 'Surveillance', value: kpis.warning, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Critique', value: kpis.critical, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-3 rounded-[10px] border border-[var(--card-border)] bg-white p-4 dark:bg-[var(--card-bg)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
              <p className={`text-[18px] tabular-nums ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-[var(--card-border)] bg-white p-4 dark:bg-[var(--card-bg)] sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Rechercher par nom, collier ID, race…"
            className="w-full rounded-[10px] border border-[var(--card-border)] bg-[#fafaf8] px-10 py-2.5 text-[13px] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] dark:bg-white/3 dark:text-[var(--text-primary)]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'Good', 'Warning', 'Critical'] as const).map((filter) => (
            <Button key={filter} variant={filterHealth === filter ? 'primary' : 'ghost'} size="sm" className="rounded-[10px]" onClick={() => setFilterHealth(filter)}>
              {filter === 'ALL' ? 'Tous' : filter === 'Good' ? '✓ Sain' : filter === 'Warning' ? '⚠ Alerte' : '🔴 Critique'}
            </Button>
          ))}
          <Button variant="ghost" size="md" onClick={exportToCSV} className="flex items-center gap-2 rounded-[10px]">
            <Download className="h-4 w-4" /> Exporter CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[var(--card-border)] bg-white dark:bg-[var(--card-bg)]">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--brand-light)] text-4xl">🐑</div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Aucun animal ne correspond aux filtres actifs.</p>
            <p className="text-[11px] text-[var(--text-muted)]">Ajustez la recherche ou les filtres pour afficher des résultats.</p>
          </div>
        ) : (
          <VirtualizedAnimalsList
            animals={filtered}
            selectedIds={selectedIdSet}
            onToggleSelection={toggleSelection}
            onSelectAnimal={openAnimalDetail}
            onNavigateAnimal={navigateToAnimal}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        )}
      </div>

      {selected.length >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--card-border)] bg-white p-4 animate-slide-up dark:bg-[var(--card-bg)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-medium text-white">{selected.length}</span>
                <p className="text-[12px] font-medium text-[var(--text-primary)]">animal{selected.length > 1 ? 'x' : ''} sélectionné{selected.length > 1 ? 's' : ''}</p>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {selected.map((id) => animals.find((animal) => animal.collar_id === id)?.name).filter(Boolean).join(' • ')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setSelected([])} className="px-4 py-2 text-[12px]">Annuler</Button>
              <Button variant="primary" onClick={goToCompare} className="px-4 py-2 text-[12px]">Comparer ↗</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
