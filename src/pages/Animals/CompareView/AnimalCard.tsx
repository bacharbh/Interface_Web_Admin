import React from 'react';
import { Heart, Thermometer, Zap } from 'lucide-react';

interface Animal {
    collar_id: string;
    name: string;
    breed?: string;
    health?: string;
    heartRate?: number;
    temperature?: number;
    activity?: number;
    battery?: number;
    [key: string]: any;
}

interface Props {
    animal: Animal;
    index: number;
}

const ANIMAL_COLORS = ['from-blue-500 to-cyan-500', 'from-orange-500 to-red-500', 'from-green-500 to-emerald-500', 'from-purple-500 to-pink-500'];

const getHealthColor = (health: string) => {
    const map = {
        Good: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30',
        Warning: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
        Critical: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
    };
    return map[health as keyof typeof map] || 'bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400';
};

export default function AnimalCard({ animal, index }: Props) {
    const battery = animal.battery ?? 0;
    const temperature = animal.temperature ?? 0;
    const initials = animal.name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 hover:shadow-md transition-shadow">
            {/* Avatar */}
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ANIMAL_COLORS[index % 4]} flex items-center justify-center text-white font-bold title-sm`}>
                    {initials}
                </div>
                <span className={`px-2.5 py-1 rounded-full label-xs font-black border ${getHealthColor(animal.health || 'Good')}`}>
                    {animal.health?.toLowerCase() || 'bon'}
                </span>
            </div>

            {/* Name & Info */}
            <div className="mb-4">
                <h4 className="title-sm text-gray-900 dark:text-white font-bold">{animal.name}</h4>
                <p className="label-xs text-gray-500 dark:text-gray-400">{animal.breed || 'Race inconnue'}</p>
                <p className="label-xs text-gray-400 font-mono mt-1">#{animal.collar_id}</p>
            </div>

            {/* Metrics */}
            <div className="space-y-2.5">
                {/* BPM */}
                <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <span className="label-xs text-gray-600 dark:text-gray-400">BPM</span>
                    </div>
                    <span className="label-sm font-bold text-gray-900 dark:text-white tabular-nums">{animal.heartRate || '—'}</span>
                </div>

                {/* Temperature */}
                <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-orange-500" />
                        <span className="label-xs text-gray-600 dark:text-gray-400">Temp.</span>
                    </div>
                    <span className={`label-sm font-bold tabular-nums ${temperature > 40 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {temperature.toFixed(1)}°
                    </span>
                </div>

                {/* Activity */}
                <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        <span className="label-xs text-gray-600 dark:text-gray-400">Activité</span>
                    </div>
                    <span className="label-sm font-bold text-gray-900 dark:text-white tabular-nums">{animal.activity || '—'}%</span>
                </div>
            </div>

            {/* Battery */}
            {animal.battery !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <p className="label-xs text-gray-600 dark:text-gray-400">Batterie</p>
                        <p className={`label-xs font-bold ${battery < 20 ? 'text-red-600 dark:text-red-400' : battery < 50 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                            {battery}%
                        </p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${battery < 20 ? 'bg-red-500' : battery < 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${battery}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
