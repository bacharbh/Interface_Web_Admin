import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAnimals from '../../hooks/useAnimals';
import { useQueries } from '@tanstack/react-query';
import { ArrowLeft, Plus, TrendingUp } from 'lucide-react';
import { useIoTStore } from '../../hooks/useIoTStore';
import animalsService, { type TelemetryPoint } from '../../services/animalsService';
import ComparisonChart from './CompareView/ComparisonChart';
import ComparisonTable from './CompareView/ComparisonTable';
import AIAnalysis from './CompareView/AIAnalysis';
import AnimalCard from './CompareView/AnimalCard';

export default function CompareView() {
    const navigate = useNavigate();
    const devicesMap = useIoTStore(state => state.devices);
    const allAnimals = useMemo(() => Object.values(devicesMap), [devicesMap]);
    const { data: animalsList = [] } = useAnimals()
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<string[]>([])
    const [metric, setMetric] = useState<'heartRate' | 'temperature' | 'activity'>('heartRate');
    const [period, setPeriod] = useState<'1h' | '6h' | '24h' | '7j'>('24h');
    const [hiddenAnimals, setHiddenAnimals] = useState<string[]>([]);

    // Preselect from URL params (/compare?ids=ID1,ID2 or /compare?a=ID1&b=ID2)
    const [params] = useSearchParams()
    useEffect(() => {
        const idsParam = params.get('ids')
        if (idsParam) {
            const parsed = idsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 2)
            if (parsed.length > 0) setSelected(parsed)
            return
        }

        const a = params.get('a')
        const b = params.get('b')
        if (a && b) setSelected([a, b])
    }, [params])

    // Selected animals resolved from the animals list or devices map
    const animals: any[] = useMemo(() => {
        return selected
            .map((id: string) =>
                animalsList.find((a: any) => a.collar_id === id || a.id === id) ||
                allAnimals.find((a: any) => a.collar_id === id || a.id === id)
            )
            .filter(Boolean);
    }, [selected, animalsList, allAnimals]);

    const telemetryRange = useMemo(() => {
        const end = new Date();
        const start = new Date(end);

        if (period === '1h') {
            start.setHours(end.getHours() - 1);
        } else if (period === '6h') {
            start.setHours(end.getHours() - 6);
        } else if (period === '24h') {
            start.setDate(end.getDate() - 1);
        } else {
            start.setDate(end.getDate() - 7);
        }

        return { from: start.toISOString(), to: end.toISOString(), limit: 500 };
    }, [period]);

    const telemetryQueries = useQueries({
        queries: animals.map((animal) => ({
            queryKey: ['animals', animal.collar_id || animal.id, 'telemetry', telemetryRange],
            queryFn: async () => animalsService.getTelemetry(animal.collar_id || animal.id, telemetryRange),
            enabled: Boolean(animal.collar_id || animal.id),
            staleTime: 30_000,
        })),
    });

    const telemetryHistory = useMemo<Record<string, TelemetryPoint[]>>(() => {
        return animals.reduce<Record<string, TelemetryPoint[]>>((accumulator, animal, index) => {
            const queryResult = telemetryQueries[index];
            const id = animal.collar_id || animal.id
            accumulator[id] = Array.isArray(queryResult?.data) ? queryResult.data : [];
            return accumulator;
        }, {});
    }, [animals, telemetryQueries]);

    // Toggle animal visibility in chart
    const toggleAnimal = (collarId: string) => {
        setHiddenAnimals(prev =>
            prev.includes(collarId)
                ? prev.filter(id => id !== collarId)
                : [...prev, collarId]
        );
    };

    // If no animals selected yet, show selector UI below (do not early-return)

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <h1 className="title-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                            <TrendingUp className="w-8 h-8 text-primary" />
                            Comparaison — {animals.length} animal{animals.length > 1 ? 'x' : ''}
                        </h1>
                    </div>
                    <p className="body-md text-gray-500 dark:text-gray-400 ml-12">
                        Analysez les différences de santé et de comportement en temps réel.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/animals')}
                    className="px-4 py-2.5 label-sm font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-2 self-start md:self-auto"
                >
                    <Plus className="w-4 h-4" />
                    Ajouter un animal
                </button>
            </div>

            {/* Animal selector (show when fewer than 2 selected) */}
            {selected.length < 2 && (
                <div className="bg-white dark:bg-card-dark p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                    <h3 className="title-sm">Sélectionner {2 - selected.length} animal(s) à comparer</h3>
                    <input
                        placeholder="Rechercher un animal..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full p-2 rounded-md border border-gray-200"
                    />
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {(animalsList || [])
                            .filter((a: any) => (a.name || '').toLowerCase().includes(search.toLowerCase()))
                            .slice(0, 20)
                            .map((animal: any) => {
                                const id = animal.collar_id || animal.id || ''
                                const isSelected = selected.includes(id)
                                return (
                                    <div
                                        key={id}
                                        onClick={() => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : (prev.length < 2 ? [...prev, id] : prev))}
                                        style={{
                                            padding: 10,
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f0f0f0',
                                            background: isSelected ? '#e1f5ee' : 'white'
                                        }}
                                    >
                                        <strong>{animal.name}</strong>
                                        <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                                            {animal.breed || animal.race} · Batterie {animal.battery ?? '—'}%
                                        </span>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            )}

            {/* Summary Cards for selected animals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {animals.map((animal, idx) => (
                    <AnimalCard key={animal.collar_id || animal.id} animal={animal} index={idx} />
                ))}
            </div>

            {/* Metric & Period Selectors */}
            <div className="bg-white dark:bg-card-dark p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                <div>
                    <p className="label-xs font-black mb-3 text-gray-600 dark:text-gray-400">MÉTRIQUE</p>
                    <div className="flex gap-2 flex-wrap">
                        {(['heartRate', 'temperature', 'activity'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMetric(m)}
                                className={`px-4 py-2 rounded-xl label-sm font-bold transition-all border ${metric === m
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-primary/40'
                                    }`}
                            >
                                {m === 'heartRate' ? '❤️ BPM' : m === 'temperature' ? '🌡️ Température' : '⚡ Activité'}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="label-xs font-black mb-3 text-gray-600 dark:text-gray-400">PÉRIODE</p>
                    <div className="flex gap-2 flex-wrap">
                        {(['1h', '6h', '24h', '7j'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-xl label-sm font-bold transition-all border ${period === p
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-primary/40'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Comparison area: only show when two animals selected */}
            {animals.length === 2 && (
                <>
                    <ComparisonChart
                        animals={animals}
                        metric={metric}
                        period={period}
                        hiddenAnimals={hiddenAnimals}
                        onToggleAnimal={toggleAnimal}
                        telemetryHistory={telemetryHistory}
                    />

                    <ComparisonTable animals={animals} metric={metric} />

                    <AIAnalysis animals={animals} />
                </>
            )}
        </div>
    );
}
