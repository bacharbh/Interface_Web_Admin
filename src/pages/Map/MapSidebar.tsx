import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ChevronLeft, Filter, MapPin, Search, Shield, Zap } from 'lucide-react';
import { IAnimal, IKpis } from '../../types';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

interface MapFilters {
    query: string;
    status: 'ALL' | 'SAFE' | 'OUT_OF_ZONE' | 'LOW_BATTERY' | 'CRITICAL';
    alertsOnly: boolean;
    criticalOnly: boolean;
    lowBatteryOnly: boolean;
    geofenceState: 'ALL' | 'IN_ZONE' | 'OUT_OF_ZONE';
    breed: string;
    activity: 'ALL' | 'REST' | 'GRAZING' | 'MOVING' | 'PANIC';
}

interface MapSidebarProps {
    allAnimals: IAnimal[];
    animalList: IAnimal[];
    kpis: IKpis;
    filters: MapFilters;
    breedOptions: string[];
    activityOptions: Array<MapFilters['activity']>;
    selectedAnimalId: string | null;
    onSelectAnimal: (id: string | null) => void;
    onFiltersChange: (next: Partial<MapFilters>) => void;
    isLoading?: boolean;
}

const STATUS_OPTIONS: Array<{ key: MapFilters['status']; label: string }> = [
    { key: 'ALL', label: 'Tous' },
    { key: 'SAFE', label: 'Sains' },
    { key: 'OUT_OF_ZONE', label: 'Hors zone' },
    { key: 'LOW_BATTERY', label: 'Batterie' },
    { key: 'CRITICAL', label: 'Critiques' },
];

const MapSidebar = React.memo(({ allAnimals, animalList, kpis, filters, breedOptions, activityOptions, selectedAnimalId, onSelectAnimal, onFiltersChange, isLoading }: MapSidebarProps) => {
    const [collapsed, setCollapsed] = useState(false);

    const statusCounts = useMemo(() => {
        return allAnimals.reduce((acc, animal) => {
            acc[animal.status] = (acc[animal.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [allAnimals]);

    const metrics = [
        { label: 'Actifs', value: kpis.totalActive, tone: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50/80 dark:bg-emerald-500/10' },
        { label: 'Alertes', value: kpis.unreadAlerts, tone: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-50/80 dark:bg-rose-500/10' },
        { label: 'Hors zone', value: kpis.outOfZone, tone: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50/80 dark:bg-amber-500/10' },
        { label: 'Faible bat.', value: kpis.lowBattery, tone: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-50/80 dark:bg-sky-500/10' },
    ];

    const toggleFilter = (next: Partial<MapFilters>) => onFiltersChange(next);

    if (isLoading) {
        return (
            <aside className="flex h-full w-full flex-col gap-4 rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-card-dark/95">
                <div className="skeleton h-5 w-32" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="skeleton h-16 rounded-2xl" />
                    <div className="skeleton h-16 rounded-2xl" />
                    <div className="skeleton h-16 rounded-2xl" />
                    <div className="skeleton h-16 rounded-2xl" />
                </div>
            </aside>
        );
    }

    if (collapsed) {
        return (
            <aside className="flex h-full w-full flex-col items-center justify-between rounded-3xl border border-gray-200 bg-white/90 px-3 py-4 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-card-dark/95">
                <button
                    aria-label="Ouvrir le panneau de troupeau"
                    onClick={() => setCollapsed(false)}
                    className="rounded-2xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition-colors hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
                <div className="flex flex-col items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Shield className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.28em] text-gray-500 [writing-mode:vertical-rl] rotate-180">
                        Troupeau
                    </span>
                </div>
                <div className="flex flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    <span>{allAnimals.length}</span>
                    <span>{kpis.outOfZone} OZ</span>
                </div>
            </aside>
        );
    }

    return (
        <aside className="flex h-full w-full flex-col gap-4 rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-gray-800 dark:bg-card-dark/95">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">GIS herd control</p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Troupeau en direct</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{animalList.length} collier(s) visibles sur la carte</p>
                </div>
                <button
                    aria-label="Réduire le panneau de troupeau"
                    onClick={() => setCollapsed(true)}
                    className="rounded-2xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition-colors hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
                    <button
                        key={metric.label}
                        onClick={() => toggleFilter(metric.label === 'Alertes' ? { alertsOnly: !filters.alertsOnly } : metric.label === 'Faible bat.' ? { lowBatteryOnly: !filters.lowBatteryOnly } : metric.label === 'Hors zone' ? { geofenceState: filters.geofenceState === 'OUT_OF_ZONE' ? 'ALL' : 'OUT_OF_ZONE' } : { status: 'ALL' })}
                        className={`rounded-2xl border border-white/70 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 ${metric.bg}`}
                    >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{metric.label}</div>
                        <div className={`mt-1 text-2xl font-semibold ${metric.tone}`}>{metric.value}</div>
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Collier, race, statut, secteur..."
                        value={filters.query}
                        onChange={(event) => onFiltersChange({ query: event.target.value })}
                        inputClassName="pl-9"
                    />
                    {filters.query && (
                        <button
                            onClick={() => onFiltersChange({ query: '' })}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => {
                        const count = option.key === 'ALL' ? allAnimals.length : (statusCounts[option.key] || 0);
                        const active = filters.status === option.key;
                        return (
                            <button
                                key={option.key}
                                onClick={() => onFiltersChange({ status: option.key })}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${active
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:text-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300'
                                    }`}
                            >
                                {option.label} <span className="ml-1 opacity-70">({count})</span>
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { key: 'alertsOnly', label: 'Alertes' },
                        { key: 'criticalOnly', label: 'Critiques' },
                        { key: 'lowBatteryOnly', label: 'Batterie faible' },
                        { key: 'OUT_OF_ZONE', label: 'Hors zone' },
                    ].map((option) => {
                        const active = option.key === 'OUT_OF_ZONE' ? filters.geofenceState === 'OUT_OF_ZONE' : Boolean(filters[option.key as keyof Pick<MapFilters, 'alertsOnly' | 'criticalOnly' | 'lowBatteryOnly'>]);
                        return (
                            <button
                                key={option.key}
                                onClick={() => {
                                    if (option.key === 'OUT_OF_ZONE') {
                                        onFiltersChange({ geofenceState: filters.geofenceState === 'OUT_OF_ZONE' ? 'ALL' : 'OUT_OF_ZONE' });
                                        return;
                                    }

                                    onFiltersChange({ [option.key]: !active } as Partial<MapFilters>);
                                }}
                                className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all ${active
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:text-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300'
                                    }`}
                            >
                                <span>{option.label}</span>
                                <Filter className="h-3.5 w-3.5 opacity-60" />
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                        value={filters.breed}
                        onChange={(event) => onFiltersChange({ breed: event.target.value })}
                        className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                    >
                        <option value="ALL">Toutes les races</option>
                        {breedOptions.map((breed) => (
                            <option key={breed} value={breed}>{breed}</option>
                        ))}
                    </select>

                    <select
                        value={filters.activity}
                        onChange={(event) => onFiltersChange({ activity: event.target.value as MapFilters['activity'] })}
                        className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                    >
                        <option value="ALL">Toutes activités</option>
                        {activityOptions.map((activity) => (
                            <option key={activity} value={activity}>{activity}</option>
                        ))}
                    </select>

                    <select
                        value={filters.geofenceState}
                        onChange={(event) => onFiltersChange({ geofenceState: event.target.value as MapFilters['geofenceState'] })}
                        className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                    >
                        <option value="ALL">Toutes zones</option>
                        <option value="IN_ZONE">En zone</option>
                        <option value="OUT_OF_ZONE">Hors zone</option>
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <MapPin className="h-4 w-4" />
                    {animalList.length} résultat(s)
                </div>
                {selectedAnimalId && (
                    <Button
                        onClick={() => onSelectAnimal(null)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                    >
                        Effacer
                    </Button>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {animalList.length > 0 ? (
                    <div className="space-y-1.5">
                        {animalList.map((animal) => (
                            <AnimalListItem
                                key={animal.collar_id}
                                animal={animal}
                                isSelected={selectedAnimalId === animal.collar_id}
                                onSelect={onSelectAnimal}
                                searchTerm={filters.query}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 text-center dark:border-gray-800 dark:bg-gray-950/40">
                        <Search className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-700" />
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Aucun résultat</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ajustez la recherche ou les filtres.</p>
                    </div>
                )}
            </div>
        </aside>
    );
});

const AnimalListItem = React.memo(({ animal, isSelected, onSelect, searchTerm }: { animal: IAnimal; isSelected: boolean; onSelect: (id: string) => void; searchTerm?: string }) => {
    const statusDot = {
        SAFE: 'bg-emerald-500',
        OUT_OF_ZONE: 'bg-rose-500 animate-pulse',
        LOW_BATTERY: 'bg-amber-500',
        CRITICAL: 'bg-red-600 animate-bounce',
    }[animal.status] || 'bg-gray-400';

    const battery = animal.battery ?? 0;
    const batteryColor = battery > 60 ? 'text-emerald-500' : battery > 20 ? 'text-amber-500' : 'text-rose-500';

    const highlight = (text: string) => {
        if (!searchTerm) return <>{text}</>;
        const term = searchTerm.toLowerCase();
        const idx = text.toLowerCase().indexOf(term);
        if (idx === -1) return <>{text}</>;
        return <>{text.substring(0, idx)}<span className="rounded bg-amber-200/80 px-0.5 dark:bg-amber-500/30">{text.substring(idx, idx + term.length)}</span>{text.substring(idx + term.length)}</>;
    };

    return (
        <button
            onClick={() => onSelect(animal.collar_id)}
            className={`group flex h-[62px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20 dark:bg-primary/10'
                : 'border-transparent bg-white/70 hover:border-primary/20 hover:bg-gray-50 dark:bg-gray-950/50 dark:hover:bg-gray-900'
                }`}
        >
            <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${statusDot}`} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {highlight(animal.name || animal.collar_id)}
                    </span>
                    {animal.status === 'OUT_OF_ZONE' && (
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                    )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                        <Zap className={`h-3.5 w-3.5 ${batteryColor}`} />
                        <span className="font-semibold">{battery}%</span>
                    </div>
                    <span className="truncate">{highlight(animal.breed || 'Sans race')}</span>
                </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-gray-300 transition-transform dark:text-gray-600 ${isSelected ? 'translate-x-0.5 text-primary' : 'group-hover:translate-x-0.5'}`} />
        </button>
    );
});

MapSidebar.displayName = 'MapSidebar';
AnimalListItem.displayName = 'AnimalListItem';

export default MapSidebar;
