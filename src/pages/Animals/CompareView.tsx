import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Brain, TrendingUp } from 'lucide-react';
import { useIoTStore } from '../../hooks/useIoTStore';
import ComparisonChart from './CompareView/ComparisonChart';
import ComparisonTable from './CompareView/ComparisonTable';
import AIAnalysis from './CompareView/AIAnalysis';
import AnimalCard from './CompareView/AnimalCard';

export default function CompareView() {
    const navigate = useNavigate();
    const location = useLocation();
    const devicesMap = useIoTStore(state => state.devices);
    const allAnimals = useMemo(() => Object.values(devicesMap), [devicesMap]);

    // Extract IDs from URL
    const animalIds = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('ids')?.split(',').filter(Boolean) || [];
    }, [location.search]);

    // Get selected animals
    const animals: any[] = useMemo(() => {
        return animalIds
            .map((id: string) => allAnimals.find(a => a.collar_id === id))
            .filter(Boolean);
    }, [animalIds, allAnimals]);

    // State management
    const [metric, setMetric] = useState<'heartRate' | 'temperature' | 'activity'>('heartRate');
    const [period, setPeriod] = useState<'1h' | '6h' | '24h' | '7j'>('24h');
    const [hiddenAnimals, setHiddenAnimals] = useState<string[]>([]);

    // Generate mock history data based on period (1 minute per point)
    const mockHistory = useMemo(() => {
        const points = period === '1h' ? 60 : period === '6h' ? 360 : period === '24h' ? 1440 : 10080;
        const intervalMs = 60 * 1000; // 1 minute
        return Array.from({ length: points }, (_, i) => ({
            timestamp: new Date(Date.now() - (points - i) * intervalMs).toISOString(),
            value: Math.random() * 40 + 70,
        }));
    }, [period]);

    // Toggle animal visibility in chart
    const toggleAnimal = (collarId: string) => {
        setHiddenAnimals(prev =>
            prev.includes(collarId)
                ? prev.filter(id => id !== collarId)
                : [...prev, collarId]
        );
    };

    if (animals.length === 0) {
        return (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 label-sm font-bold text-primary hover:opacity-75 transition-opacity"
                >
                    <ArrowLeft className="w-4 h-4" /> Retour
                </button>
                <div className="text-center py-24 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center text-4xl">🐑</div>
                    <p className="label-sm font-black text-gray-400 tracking-widest">Sélectionnez des animaux</p>
                    <p className="text-gray-400 text-xs">Retournez à la liste pour en choisir au moins 2.</p>
                </div>
            </div>
        );
    }

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

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {animals.map((animal, idx) => (
                    <AnimalCard key={animal.collar_id} animal={animal} index={idx} />
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

            {/* Comparison Chart */}
            <ComparisonChart
                animals={animals}
                metric={metric}
                period={period}
                hiddenAnimals={hiddenAnimals}
                onToggleAnimal={toggleAnimal}
                history={mockHistory}
            />

            {/* Comparison Table */}
            <ComparisonTable animals={animals} metric={metric} />

            {/* AI Analysis */}
            <AIAnalysis animals={animals} />
        </div>
    );
}
