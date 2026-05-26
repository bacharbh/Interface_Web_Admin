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
import { TelemetryPoint } from '../../../services/animalsService';

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

interface Props {
    animals: Animal[];
    metric: 'heartRate' | 'temperature' | 'activity' | 'speed';
    period: '1h' | '6h' | '24h' | '7j';
    hiddenAnimals: string[];
    onToggleAnimal: (collarId: string) => void;
    telemetryHistory: Record<string, TelemetryPoint[]>;
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
    telemetryHistory,
}: Props) {
    const metricInfo = getMetricLabel(metric);
    const storeHistory = useIoTStore(state => state.history);

    const resolveMetricValue = (point: TelemetryPoint | IAnimal | undefined) => {
        if (!point) return undefined;
        return point[metric as keyof typeof point] as number | undefined;
    };

    const getClosestTelemetryValue = (points: TelemetryPoint[], targetTimestamp: number) => {
        if (points.length === 0) return undefined;

        const closest = points.reduce((best, current) => {
            const bestDiff = Math.abs(new Date(best.timestamp).getTime() - targetTimestamp);
            const currentDiff = Math.abs(new Date(current.timestamp).getTime() - targetTimestamp);
            return currentDiff < bestDiff ? current : best;
        });

        const closestTimestamp = new Date(closest.timestamp).getTime();
        if (Math.abs(closestTimestamp - targetTimestamp) > 5 * 60 * 1000) {
            return undefined;
        }

        return resolveMetricValue(closest);
    };

    const combinedTimeline = useMemo(() => {
        const timestamps = new Set<number>();

        animals.forEach((animal) => {
            const telemetryPoints = telemetryHistory[animal.collar_id] ?? storeHistory[animal.collar_id] ?? [];
            telemetryPoints.forEach((point) => {
                const timestamp = new Date(point.timestamp).getTime();
                if (Number.isFinite(timestamp)) {
                    timestamps.add(timestamp);
                }
            });
        });

        const ordered = [...timestamps].sort((left, right) => left - right);
        const rawPoints: Point[] = ordered.map((timestamp) => ({ x: timestamp, y: 0 }));
        const { sampledData } = downsampleTimeSeries(rawPoints);
        return sampledData.map((point) => point.x);
    }, [animals, storeHistory, telemetryHistory]);

    const chartData = useMemo(() => {
        const rawPoints: Point[] = combinedTimeline.map((timestamp) => ({ x: timestamp, y: 0 }));
        const { sampledData, isCompressed } = downsampleTimeSeries(rawPoints);
        const labels = sampledData.map((point) => new Date(point.x).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

        const datasets = animals
            .filter(a => !hiddenAnimals.includes(a.collar_id))
            .map((animal, idx) => {
                const telemetryPoints = telemetryHistory[animal.collar_id] ?? [];
                const animalStoreHistory = storeHistory[animal.collar_id] || [];

                return {
                    label: `${animal.name} #${animal.collar_id}`,
                    data: sampledData.map((point) => {
                        const telemetryValue = getClosestTelemetryValue(telemetryPoints, point.x);
                        if (telemetryValue !== undefined) {
                            return telemetryValue;
                        }

                        if (animalStoreHistory.length > 0) {
                            const closest = animalStoreHistory.reduce((best, current) => {
                                const bestTime = new Date(best.lastUpdate || 0).getTime();
                                const currentTime = new Date(current.lastUpdate || 0).getTime();
                                return Math.abs(currentTime - point.x) < Math.abs(bestTime - point.x) ? current : best;
                            });

                            const storedValue = resolveMetricValue(closest);
                            if (storedValue !== undefined) {
                                return storedValue;
                            }
                        }

                        const baseValue = (animal[metric] as number) || (metricInfo.min + metricInfo.max) / 2;
                        return Math.min(Math.max(baseValue, metricInfo.min), metricInfo.max);
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
    }, [animals, combinedTimeline, hiddenAnimals, metric, metricInfo.max, metricInfo.min, storeHistory, telemetryHistory]);

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
