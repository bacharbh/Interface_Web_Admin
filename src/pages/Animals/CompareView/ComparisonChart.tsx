import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { downsampleTimeSeries, Point } from '../../../utils/downsample';
import { useIoTStore } from '../../../hooks/useIoTStore';
import { IAnimal } from '../../../types';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface Animal {
    collar_id: string;
    name: string;
    heartRate?: number;
    temperature?: number;
    activity?: number;
    [key: string]: any;
}

interface HistoryPoint {
    timestamp: string;
    value: number;
}

interface Props {
    animals: Animal[];
    metric: 'heartRate' | 'temperature' | 'activity' | 'speed';
    period: '1h' | '6h' | '24h' | '7j';
    hiddenAnimals: string[];
    onToggleAnimal: (collarId: string) => void;
    history: HistoryPoint[];
}

const ANIMAL_COLORS = ['#1D9E75', '#378ADD', '#EF9F27', '#E24B4A'];

// --- Utils for deterministic random data ---
const getHashCode = (s: string) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

function seedRandom(seed: number): number {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

const getMetricLabel = (metric: string) => {
    const map = {
        heartRate: { label: 'BPM', unit: 'bpm', min: 70, max: 120 },
        temperature: { label: 'Température', unit: '°C', min: 37, max: 40 },
        activity: { label: 'Activité', unit: '%', min: 0, max: 100 },
        battery: { label: 'Batterie', unit: '%', min: 0, max: 100 },
        speed: { label: 'Vitesse', unit: 'km/h', min: 0, max: 15 },
    };
    return map[metric as keyof typeof map] || { label: metric, unit: '', min: 0, max: 100 };
};

export default function ComparisonChart({
    animals,
    metric,
    period,
    hiddenAnimals,
    onToggleAnimal,
    history,
}: Props) {
    const metricInfo = getMetricLabel(metric);
    const storeHistory = useIoTStore(state => state.history);

    const chartData = useMemo(() => {
        // Prepare data for downsampling
        const rawPoints: Point[] = history.map(h => ({
            x: new Date(h.timestamp).getTime(),
            y: h.value
        }));

        const { sampledData, isCompressed } = downsampleTimeSeries(rawPoints);

        const labels = sampledData.map(p => {
            const date = new Date(p.x);
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        });

        const datasets = animals
            .filter(a => !hiddenAnimals.includes(a.collar_id))
            .map((animal, idx) => {
                const animalIdHash = getHashCode(animal.collar_id);
                const animalStoreHistory = storeHistory[animal.collar_id] || [];

                return {
                    label: `${animal.name} #${animal.collar_id}`,
                    data: sampledData.map((p, pointIdx) => {
                        // 1. Try to find real data in Zustand store
                        if (animalStoreHistory.length > 0) {
                            // Find the point closest in time (within a 5-minute window)
                            const closest = animalStoreHistory.reduce((prev, curr) => {
                                const currTime = new Date(curr.lastUpdate || 0).getTime();
                                const prevTime = new Date(prev.lastUpdate || 0).getTime();
                                return Math.abs(currTime - p.x) < Math.abs(prevTime - p.x) ? curr : prev;
                            });

                            const closestTime = new Date(closest.lastUpdate || 0).getTime();
                            if (Math.abs(closestTime - p.x) < 300000) { // 5 minutes tolerance
                                const val = closest[metric as keyof IAnimal] as number;
                                if (val !== undefined && val !== null) return val;
                            }
                        }

                        // 2. Fallback to deterministic seeded random data
                        const baseValue = (animal[metric] as number) || (metricInfo.min + metricInfo.max) / 2;
                        const seed = animalIdHash + pointIdx;
                        const randomValue = seedRandom(seed);
                        
                        // Scale variation based on metric
                        let variationRange = 10;
                        if (metric === 'temperature') variationRange = 0.5;
                        if (metric === 'activity') variationRange = 20;
                        if (metric === 'speed') variationRange = 2;
                        
                        let finalValue = baseValue + (randomValue - 0.5) * variationRange;
                        
                        // 3. Clamp to realistic ranges
                        return Math.min(Math.max(finalValue, metricInfo.min), metricInfo.max);
                    }),
                    borderColor: ANIMAL_COLORS[idx % ANIMAL_COLORS.length],
                    backgroundColor: ANIMAL_COLORS[idx % ANIMAL_COLORS.length] + '18',
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: ANIMAL_COLORS[idx % ANIMAL_COLORS.length],
                    fill: true,
                    borderWidth: 2,
                };
            });

        return { labels, datasets, isCompressed };
    }, [animals, metric, hiddenAnimals, history]);

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
                onClick: (e: any) => {
                    const index = e.datasetIndex;
                    const collarId = animals[index]?.collar_id;
                    if (collarId) {
                        onToggleAnimal(collarId);
                    }
                },
                labels: {
                    font: { size: 12, weight: 'bold' as const },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle' as const,
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 13, weight: 'bold' as const },
                bodyFont: { size: 12 },
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                callbacks: {
                    label: function (context: any) {
                        let label = `${context.dataset.label}: ${context.parsed.y.toFixed(1)} ${metricInfo.unit}`;
                        if (chartData.isCompressed) {
                            label += ' (données compressées)';
                        }
                        return label;
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: false,
                min: metricInfo.min * 0.95,
                max: metricInfo.max * 1.05,
                ticks: {
                    font: { size: 11, weight: 'bold' as const },
                    callback: function (value: any) {
                        return `${value}${metricInfo.unit}`;
                    },
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false,
                },
            },
            x: {
                ticks: {
                    font: { size: 11, weight: 'bold' as const },
                },
                grid: {
                    display: false,
                    drawBorder: false,
                },
            },
        },
    };

    return (
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="title-md text-gray-900 dark:text-white">{metricInfo.label} en temps réel</h2>
                    <p className="label-xs text-gray-500 dark:text-gray-400 mt-1">
                        Cliquez sur une légende pour masquer/afficher un animal
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                    <span className="label-xs font-bold text-blue-600 dark:text-blue-400">
                        Plage: {metricInfo.min}-{metricInfo.max} {metricInfo.unit}
                    </span>
                </div>
            </div>

            <div className="h-96 relative">
                <Line data={chartData} options={options} />
            </div>

            {hiddenAnimals.length > 0 && (
                <p className="label-xs text-gray-400 text-center">
                    {hiddenAnimals.length} animal{hiddenAnimals.length > 1 ? 'x' : ''} masqué{hiddenAnimals.length > 1 ? 's' : ''} •
                    Cliquez sur la légende pour afficher
                </p>
            )}
        </div>
    );
}
