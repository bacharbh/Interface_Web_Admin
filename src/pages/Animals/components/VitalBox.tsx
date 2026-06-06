import React from 'react';

interface VitalBoxProps {
    label: string;
    value: number | null | undefined;
    unit: string;
    range: { min: number; max: number };
    icon: React.ReactNode;
}

const VitalBox: React.FC<VitalBoxProps> = ({ label, value, unit, range, icon }) => {
    if (value == null || isNaN(value as number)) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
                    <div className="text-gray-200 dark:text-gray-700 opacity-70">{icon}</div>
                </div>
                <div className="text-3xl font-bold font-mono text-gray-300 dark:text-gray-600 mb-1">N/A</div>
                <p className="text-xs text-gray-400 dark:text-gray-600">Données non disponibles</p>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full mt-4" />
            </div>
        );
    }

    const isAbnormal = value < range.min || value > range.max;
    let color: string;
    let progressBarColor: string;

    if (isAbnormal) {
        if (value > range.max * 1.15 || value < range.min * 0.85) {
            color = '#E24B4A';
            progressBarColor = 'bg-red-500';
        } else {
            color = '#EF9F27';
            progressBarColor = 'bg-orange-500';
        }
    } else {
        color = '#1D9E75';
        progressBarColor = 'bg-green-500';
    }

    const range_span = range.max - range.min;
    const percentage = ((value - range.min) / range_span) * 100;
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                <div style={{ color }} className="opacity-70">{icon}</div>
            </div>

            <div className="mb-4">
                <div style={{ color }} className="text-4xl font-bold font-mono">
                    {value.toFixed(1)}{unit}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Normal: {range.min}–{range.max}{unit}
                </p>
            </div>

            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                    style={{ width: `${clampedPercentage}%` }}
                />
            </div>

            <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span style={{ color }} className="text-xs font-semibold">
                    {isAbnormal ? 'Anormal' : 'Normal'}
                </span>
            </div>
        </div>
    );
};

export default VitalBox;
