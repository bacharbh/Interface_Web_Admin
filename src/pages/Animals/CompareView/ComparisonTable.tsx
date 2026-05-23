import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Animal {
    collar_id: string;
    name: string;
    heartRate?: number;
    temperature?: number;
    activity?: number;
    [key: string]: any;
}

interface Props {
    animals: Animal[];
    metric: 'heartRate' | 'temperature' | 'activity';
}

const RANGES = {
    heartRate: { min: 70, max: 120, normal: [70, 120] },
    temperature: { min: 38.5, max: 39.5, normal: [38.5, 39.5] },
    activity: { min: 50, max: 100, normal: [50, 100] },
};

const getValueColor = (value: number, range: { min: number; max: number }) => {
    if (value < range.min || value > range.max) {
        if (value > range.max * 1.15) {
            return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30' };
        }
        return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30' };
    }
    return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' };
};

const getIcon = (value: number, range: { min: number; max: number }) => {
    if (value < range.min || value > range.max) {
        if (value > range.max * 1.15) {
            return <AlertCircle className="w-4 h-4" />;
        }
        return <AlertTriangle className="w-4 h-4" />;
    }
    return <CheckCircle2 className="w-4 h-4" />;
};

export default function ComparisonTable({ animals, metric }: Props) {
    const range = RANGES[metric];
    const metricLabel = metric === 'heartRate' ? 'BPM' : metric === 'temperature' ? 'Température (°C)' : 'Activité (%)';

    const stats = useMemo(() => {
        const values = animals.map(a => (a[metric as keyof Animal] as number) || 0);
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const gap = max - min;

        return { min, max, avg, gap };
    }, [animals, metric]);

    return (
        <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 space-y-2">
                <h3 className="title-sm text-gray-900 dark:text-white">Tableau comparatif — {metricLabel}</h3>
                <p className="label-xs text-gray-500 dark:text-gray-400">
                    Écart max: <span className="font-bold text-gray-700 dark:text-gray-300">{stats.gap.toFixed(1)}</span> •
                    Moyenne: <span className="font-bold text-gray-700 dark:text-gray-300">{stats.avg.toFixed(1)}</span>
                </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                            <th className="px-6 py-3.5 text-left label-xs font-black text-gray-600 dark:text-gray-400 tracking-wider">
                                Animal
                            </th>
                            {animals.map((animal, idx) => (
                                <th
                                    key={animal.collar_id}
                                    className="px-6 py-3.5 text-center label-xs font-black text-gray-600 dark:text-gray-400 tracking-wider"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor: ['#1D9E75', '#378ADD', '#EF9F27', '#E24B4A'][idx % 4],
                                            }}
                                        />
                                        {animal.name}
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-3.5 text-center label-xs font-black text-gray-600 dark:text-gray-400 tracking-wider">
                                Écart max
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Plage normale row */}
                        <tr className="border-b border-gray-100 dark:border-gray-800 bg-blue-50/30 dark:bg-blue-500/5">
                            <td className="px-6 py-3.5 label-xs font-bold text-gray-700 dark:text-gray-300">
                                Plage normale
                            </td>
                            {animals.map(animal => (
                                <td
                                    key={animal.collar_id}
                                    className="px-6 py-3.5 text-center label-xs font-bold text-blue-600 dark:text-blue-400"
                                >
                                    {range.min}–{range.max}
                                </td>
                            ))}
                            <td className="px-6 py-3.5 text-center label-xs font-bold text-gray-500">—</td>
                        </tr>

                        {/* Values row */}
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-6 py-3.5 label-xs font-bold text-gray-700 dark:text-gray-300">
                                Valeur actuelle
                            </td>
                            {animals.map((animal, idx) => {
                                const value = (animal[metric as keyof Animal] as number) || 0;
                                const styles = getValueColor(value, range);
                                return (
                                    <td
                                        key={animal.collar_id}
                                        className={`px-6 py-3.5 text-center label-xs font-bold border rounded-lg ${styles.bg} ${styles.border}`}
                                    >
                                        <div className={`flex items-center justify-center gap-2 ${styles.color}`}>
                                            {getIcon(value, range)}
                                            <span>{value.toFixed(1)}</span>
                                        </div>
                                    </td>
                                );
                            })}
                            <td className="px-6 py-3.5 text-center label-xs font-bold text-gray-700 dark:text-gray-300">
                                {stats.gap.toFixed(1)}
                            </td>
                        </tr>

                        {/* Status row */}
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                            <td className="px-6 py-3.5 label-xs font-bold text-gray-700 dark:text-gray-300">
                                Statut
                            </td>
                            {animals.map(animal => {
                                const value = (animal[metric as keyof Animal] as number) || 0;
                                let status = 'Bon';
                                let statusClass = 'text-green-600 dark:text-green-400';

                                if (value < range.min || value > range.max) {
                                    status = value > range.max * 1.15 ? 'Critique' : 'Alerte';
                                    statusClass = value > range.max * 1.15 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400';
                                }

                                return (
                                    <td key={animal.collar_id} className={`px-6 py-3.5 text-center label-xs font-bold ${statusClass}`}>
                                        {status}
                                    </td>
                                );
                            })}
                            <td className="px-6 py-3.5 text-center label-xs font-bold text-gray-500">—</td>
                        </tr>

                        {/* Variance from normal row */}
                        <tr>
                            <td className="px-6 py-3.5 label-xs font-bold text-gray-700 dark:text-gray-300">
                                Écart à la normale
                            </td>
                            {animals.map(animal => {
                                const value = (animal[metric as keyof Animal] as number) || 0;
                                const avgNormal = (range.min + range.max) / 2;
                                const variance = value - avgNormal;
                                const styles = getValueColor(value, range);

                                return (
                                    <td
                                        key={animal.collar_id}
                                        className={`px-6 py-3.5 text-center label-xs font-bold border rounded-lg ${styles.bg} ${styles.border}`}
                                    >
                                        <span className={styles.color}>
                                            {variance >= 0 ? '+' : ''}{variance.toFixed(1)}
                                        </span>
                                    </td>
                                );
                            })}
                            <td className="px-6 py-3.5 text-center label-xs font-bold text-gray-500">—</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
