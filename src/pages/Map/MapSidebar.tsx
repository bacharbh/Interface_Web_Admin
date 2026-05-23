import React, { useState, useMemo, useEffect } from 'react';
import { Shield, MapPin, Zap, AlertTriangle, Search, ChevronRight } from 'lucide-react';
import { IAnimal, IKpis } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface MapSidebarProps {
  animalList: IAnimal[];
  kpis: IKpis;
  selectedAnimalId: string | null;
  onSelectAnimal: (id: string | null) => void;
  isLoading?: boolean;
}

const MapSidebar = React.memo(({ animalList, kpis, selectedAnimalId, onSelectAnimal, isLoading }: MapSidebarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredAnimals = useMemo(() => {
    let list = [...animalList];

    // Search filter
    if (debouncedTerm) {
      const term = debouncedTerm.toLowerCase();
      list = list.filter(a =>
        (a.name || '').toLowerCase().includes(term) ||
        (a.collar_id || '').toLowerCase().includes(term) ||
        (a.breed || '').toLowerCase().includes(term) ||
        (a.status || '').toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterStatus !== 'ALL') {
      list = list.filter(a => a.status === filterStatus);
    }

    // Sort: critical/out-of-zone first
    return list.sort((a, b) => {
      const priority: Record<string, number> = { CRITICAL: 0, OUT_OF_ZONE: 1, LOW_BATTERY: 2, SAFE: 3 };
      return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
    });
  }, [animalList, debouncedTerm, filterStatus]);

  if (isLoading) {
    return (
      <div className="w-full md:w-80 flex flex-col gap-4 animate-fade-in h-full">
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="skeleton h-4 w-32 mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 flex flex-col gap-4 animate-fade-in h-full">
      {/* Herd Status Card */}
      <div className="bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
        <h2 className="title-sm text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" /> État du troupeau
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Actifs" value={kpis.totalActive} color="text-green-600" bg="bg-green-50 dark:bg-green-500/10" onClick={() => setFilterStatus('ALL')} />
          <StatBox label="Hors zone" value={kpis.outOfZone} color="text-red-600" bg="bg-red-50 dark:bg-red-500/10" alert={kpis.outOfZone > 0} onClick={() => setFilterStatus('OUT_OF_ZONE')} />
          <StatBox label="Batterie" value={kpis.lowBattery} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" onClick={() => setFilterStatus('LOW_BATTERY')} />
          <StatBox label="Alertes" value={kpis.unreadAlerts} color="text-red-600" bg="bg-red-50 dark:bg-red-500/10" alert={kpis.unreadAlerts > 0} onClick={() => setFilterStatus('CRITICAL')} />
        </div>
      </div>

      {/* Animal List Container */}
      <div className="flex-1 bg-white dark:bg-card-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col transition-colors">
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputClassName="pl-8 text-xs"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {[
              { key: 'ALL', label: 'Tous' },
              { key: 'SAFE', label: 'Sain' },
              { key: 'OUT_OF_ZONE', label: 'Hors zone' },
              { key: 'LOW_BATTERY', label: 'Batterie faible' },
              { key: 'CRITICAL', label: 'Critique' },
            ].map(({ key, label }) => {
              const counts: Record<string, number> = animalList.reduce((acc, a) => {
                acc[a.status] = (acc[a.status] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              const count = key === 'ALL' ? animalList.length : (counts[key] || 0);
              return (
                <Button
                  key={key}
                  onClick={() => setFilterStatus(key)}
                  variant={filterStatus === key ? 'primary' : 'secondary'}
                  size="sm"
                  className={`px-2 py-1 rounded-md label-xs font-bold transition-all ${filterStatus === key ? '' : 'text-gray-500 dark:text-gray-300'}`}
                >
                  {label} {count !== undefined && (<span className="ml-1 text-[10px] opacity-80">({count})</span>)}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-gray-400" />
            {filteredAnimals.length} Collier(s)
          </h2>
          {selectedAnimalId && (
            <Button
              onClick={() => onSelectAnimal(null)}
              variant="ghost"
              size="sm"
              className="label-xs"
            >
              Effacer
            </Button>
          )}
        </div>

        {/* Standard Scrollable List */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {filteredAnimals.length > 0 ? (
            <div className="space-y-1">
              {filteredAnimals.map((animal) => (
                <AnimalListItem
                  key={animal.collar_id}
                  animal={animal}
                  isSelected={selectedAnimalId === animal.collar_id}
                  onSelect={onSelectAnimal}
                  searchTerm={debouncedTerm}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Search className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Aucun résultat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// --- Sub-components ---

const StatBox = React.memo(({ label, value, color, bg, alert, onClick }: any) => (
  <button onClick={onClick} className={`${bg} rounded-lg p-2.5 transition-all ${alert ? 'ring-1 ring-red-200 dark:ring-red-500/30' : ''} hover:brightness-95`}>
    <p className="label-xs">{label}</p>
    <p className={`title-md ${color} mt-0.5 ${alert ? 'animate-pulse' : ''}`}>{value}</p>
  </button>
));

const AnimalListItem = React.memo(({ animal, isSelected, onSelect, searchTerm }: { animal: IAnimal, isSelected: boolean, onSelect: (id: string) => void, searchTerm?: string }) => {
  const statusDot = {
    SAFE: 'bg-green-500',
    OUT_OF_ZONE: 'bg-red-500 animate-pulse',
    LOW_BATTERY: 'bg-amber-500',
    CRITICAL: 'bg-red-600 animate-bounce',
  }[animal.status] || 'bg-gray-400';

  const battery = animal.battery ?? 0;
  const batteryColor = battery > 60 ? 'text-green-500' : battery > 20 ? 'text-amber-500' : 'text-red-500';

  const highlight = (text: string) => {
    if (!searchTerm) return <>{text}</>;
    const term = searchTerm.toLowerCase();
    const idx = text.toLowerCase().indexOf(term);
    if (idx === -1) return <>{text}</>;
    return <>{text.substring(0, idx)}<span className="bg-yellow-200 dark:bg-yellow-600/30">{text.substring(idx, idx + term.length)}</span>{text.substring(idx + term.length)}</>;
  };

  return (
    <button
      onClick={() => onSelect(animal.collar_id)}
      className={`w-full text-left p-2 rounded-lg border transition-all group h-[56px] mb-1 flex items-center gap-2.5 ${isSelected
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20 dark:bg-primary/10'
        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="title-sm text-gray-900 dark:text-white truncate">
            {animal.name || animal.collar_id}
          </span>
          {animal.status === 'OUT_OF_ZONE' && (
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-0.5">
            <Zap className={`w-2.5 h-2.5 ${batteryColor}`} />
            <span className="text-[8px] font-bold text-gray-500">{battery}%</span>
          </div>
          <span className="text-[8px] text-gray-400 truncate">{animal.breed || 'Sans race'}</span>
        </div>
      </div>
      <ChevronRight className={`w-3.5 h-3.5 text-gray-300 dark:text-gray-600 transition-transform ${isSelected ? 'text-primary rotate-90' : 'group-hover:translate-x-0.5'}`} />
    </button>
  );
});

MapSidebar.displayName = 'MapSidebar';
StatBox.displayName = 'StatBox';
AnimalListItem.displayName = 'AnimalListItem';

export default MapSidebar;
