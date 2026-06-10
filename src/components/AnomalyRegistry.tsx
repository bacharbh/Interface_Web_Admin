import React, { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Clock, TrendingUp } from 'lucide-react';
import Button from './ui/Button';
import { useRealtimePositions } from '../hooks/useRealtimePositions';
import api from '../services/api';

interface AnomalyRecord {
    collar_id: string;
    name: string;
    bpm: number | null;
    temperature: number | null;
    activity: number | null;
    health: string;
    battery: number | null;
    timestamp: string;
    isAtRisk: boolean;
}

interface AIAnalysis {
    summary: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'N/A';
    riskScore?: number;
    riskAnimalIds: string[];
    suggestions: string[];
    fallback?: boolean;
}

interface PersistedAnomaly {
    _id?: string;
    animalId?: string;
    collar_id?: string;
    name?: string;
    score?: number;
    detectedAt?: string;
    timestamp?: string;
    resolved?: boolean;
    features?: {
        temperature?: number;
        movementRate?: number;
        heartRate?: number;
    };
}

const normalizeHealth = (health: string): string => {
    if (!health) return 'Unknown';
    const lower = health.toLowerCase();
    if (lower === 'critical') return 'Critical';
    if (lower === 'warning') return 'Warning';
    if (lower === 'good') return 'Good';
    if (lower === 'resolved') return 'Résolu';
    return health;
};

const timeAgo = (past: Date, now: Date): string => {
    const secs = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (secs < 60) return `il y a ${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `il y a ${mins}min`;
    return `il y a ${Math.floor(mins / 60)}h`;
};

const activityLabel = (activity: number | null): string => {
    if (activity === null) return '—';
    if (activity === 0) return 'Inactif';
    if (activity === 1) return 'Repos';
    if (activity === 2) return 'Pâture';
    if (activity === 3) return 'Marche';
    if (activity >= 4) return 'Course';
    return String(activity);
};

const AnomalyRegistry: React.FC = () => {
    const { animalsList } = useRealtimePositions([]);
    const [anomalyRecords, setAnomalyRecords] = useState<AnomalyRecord[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
    const [lastAIUpdate, setLastAIUpdate] = useState<Date | null>(null);
    const [now, setNow] = useState(() => new Date());

    // Live clock — ticks every second
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    const anomaliesRef = useRef<Map<string, number>>(new Map());
    const lastAIRequestAtRef = useRef<number>(0);
    const lastAIRequestSignatureRef = useRef<string>('');
    const aiRequestInFlightRef = useRef(false);
    const lastAnomalySignatureRef = useRef<string>('');
    const lastPersistedAnomalySignatureRef = useRef<string>('');

    const { data: persistedAnomalies = [], refetch: refetchPersisted } = useQuery<PersistedAnomaly[]>({
        queryKey: ['anomalies'],
        queryFn: () => api.get('/anomalies').then((response) => response.data?.data ?? []),
        refetchInterval: 30000,
    });

    const animalsSignature = animalsList
        .map(animal => `${animal.collar_id || animal.id || 'na'}:${animal.health || 'Unknown'}:${animal.battery ?? 0}:${animal.temperature ?? 0}:${animal.heartRate ?? 0}`)
        .sort()
        .join('|');

    const aiRiskSignature = aiAnalysis?.riskAnimalIds?.slice().sort().join('|') ?? '';

    const persistAnomalies = async (records: AnomalyRecord[], signature: string) => {
        try {
            await Promise.all(
                records.map((record) =>
                    api.post('/anomalies', {
                        animalId: record.collar_id,
                        name: record.name,
                        score: record.health === 'Critical' ? 1 : record.health === 'Warning' ? 0.7 : 0.4,
                        features: {
                            temperature: record.temperature,
                            movementRate: record.activity,
                            heartRate: record.bpm,
                        },
                        detectedAt: new Date().toISOString(),
                        resolved: false,
                    })
                )
            );
            lastPersistedAnomalySignatureRef.current = signature;
        } catch (error: any) {
            console.error('Anomaly persistence error:', error?.response?.data || error?.message || error);
        }
    };

    useEffect(() => {
        if (animalsList.length === 0) return;

        const problematicAnimals = animalsList.filter(animal => {
            const h = (animal.health as string)?.toLowerCase();
            return h === 'critical' || h === 'warning' ||
                (animal.battery ?? 100) < 20 ||
                (animal.temperature ?? 38) > 40 ||
                (animal.temperature ?? 38) < 37;
        });

        const newRecords: AnomalyRecord[] = problematicAnimals.map((animal, index) => {
            const collarId = animal.collar_id || animal.id || `collar_${index}`;
            const battery = animal.battery ?? null;
            const temperature = animal.temperature ?? null;
            const heartRate = animal.heartRate != null ? animal.heartRate : null;
            const activity = (animal as any).activity_level ?? (animal as any).activity ?? null;
            const health = normalizeHealth(animal.health || 'Unknown');

            const anomalyScore =
                (health === 'Critical' ? 30 : health === 'Warning' ? 15 : 0) +
                ((battery !== null && battery < 20) ? 20 : (battery !== null && battery < 50) ? 10 : 0) +
                ((temperature !== null && (temperature > 39 || temperature < 37)) ? 15 : 0) +
                ((heartRate !== null && (heartRate > 120 || heartRate < 40)) ? 25 : 0);

            anomaliesRef.current.set(collarId, anomalyScore);

            return {
                collar_id: collarId,
                name: animal.name || `Animal #${collarId.slice(-4)}`,
                bpm: heartRate,
                temperature,
                activity,
                health,
                battery,
                timestamp: new Date().toLocaleTimeString('fr-FR'),
                isAtRisk: health === 'Critical' || Boolean(aiAnalysis?.riskAnimalIds?.includes(collarId)),
            };
        });

        const signature = newRecords
            .map(record => `${record.collar_id}:${record.health}:${record.battery}:${record.temperature}:${record.bpm}:${record.activity}:${record.isAtRisk ? 1 : 0}`)
            .join('|');

        if (signature !== lastAnomalySignatureRef.current) {
            lastAnomalySignatureRef.current = signature;
            setAnomalyRecords(newRecords);
            setLastDataUpdate(new Date());

            if (newRecords.length > 0 && signature !== lastPersistedAnomalySignatureRef.current) {
                void persistAnomalies(newRecords, signature);
            }
        }
    }, [animalsSignature, aiRiskSignature]);

    useEffect(() => {
        if (animalsList.length === 0) return;

        const aiTimer = setTimeout(async () => {
            if (aiRequestInFlightRef.current) return;

            const now = Date.now();
            if (now - lastAIRequestAtRef.current < 30000) return;

            const signature = animalsList
                .map(animal => `${animal.collar_id || animal.id || 'na'}:${animal.health || 'Unknown'}:${animal.battery ?? 0}:${animal.temperature ?? 0}:${animal.heartRate ?? 0}`)
                .sort()
                .join('|');

            if (signature === lastAIRequestSignatureRef.current) return;

            aiRequestInFlightRef.current = true;
            setIsLoading(true);
            try {
                lastAIRequestAtRef.current = now;
                lastAIRequestSignatureRef.current = signature;
                const payload = {
                    animals: animalsList.map(animal => ({
                        name: animal.name || `Animal #${animal.collar_id || animal.id || 'N/A'}`,
                        collar_id: animal.collar_id || animal.id,
                        bpm: animal.heartRate ?? 0,
                        temperature: animal.temperature ?? 0,
                        activity: (animal as any).activity_level ?? (animal as any).activity ?? 0,
                        health: animal.health || 'Unknown',
                        battery: animal.battery ?? 0,
                    }))
                };

                const response = await api.post('/ai/analyze', payload, { timeout: 12000 });

                if (response?.data) {
                    const data = response.data;
                    const analysisData = (data.success || data.fallback) && data.data ? data.data : null;
                    if (analysisData) {
                        setAiAnalysis(analysisData);
                        setLastAIUpdate(new Date());
                    } else {
                        setLastAIUpdate(new Date());
                    }
                }
            } catch (error: any) {
                console.error('AI Analysis error:', error?.response?.data || error?.message);
                setAiAnalysis({
                    riskLevel: 'N/A',
                    riskScore: 0,
                    summary: !error.response
                        ? 'Service IA hors ligne — vérifiez la connexion backend.'
                        : error?.response?.status === 500
                            ? 'Erreur interne du service IA (500).'
                            : 'Analyse IA indisponible.',
                    suggestions: [],
                    riskAnimalIds: [],
                    fallback: true,
                });
                setLastAIUpdate(new Date());
            } finally {
                aiRequestInFlightRef.current = false;
                setIsLoading(false);
            }
        }, 500);

        return () => clearTimeout(aiTimer);
    }, [animalsSignature]);

    const handleRefresh = () => {
        lastAnomalySignatureRef.current = '';
        lastAIRequestAtRef.current = 0;
        lastAIRequestSignatureRef.current = '';
        lastPersistedAnomalySignatureRef.current = '';
        void refetchPersisted();
    };

    const getRiskLevelColor = (level?: string) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
            case 'HIGH': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
            case 'MEDIUM': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
            case 'LOW': return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
            default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
        }
    };

    const getHealthBadge = (health: string) => {
        switch (health) {
            case 'Good': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Warning': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'Résolu': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        }
    };

    // Persisted anomalies: one entry per animal (most recent), battery unknown
    const persistedByCollar = new Map<string, AnomalyRecord>();
    for (const anomaly of persistedAnomalies) {
        const collarId = anomaly.animalId || anomaly.collar_id || anomaly._id || '';
        if (!collarId) continue;
        const record: AnomalyRecord = {
            collar_id: collarId,
            name: anomaly.name || anomaly.animalId || anomaly.collar_id || 'Inconnu',
            bpm: anomaly.features?.heartRate ?? null,
            temperature: anomaly.features?.temperature ?? null,
            activity: anomaly.features?.movementRate ?? null,
            health: normalizeHealth(anomaly.resolved ? 'resolved' : 'warning'),
            battery: null,
            timestamp: anomaly.detectedAt || anomaly.timestamp || new Date().toISOString(),
            isAtRisk: !anomaly.resolved,
        };
        // Keep the most recent entry per collar
        const existing = persistedByCollar.get(collarId);
        if (!existing || new Date(record.timestamp) > new Date(existing.timestamp)) {
            persistedByCollar.set(collarId, record);
        }
    }

    // Real-time anomalies override persisted entries for the same collar_id
    const deduped = new Map<string, AnomalyRecord>(persistedByCollar);
    for (const record of anomalyRecords) {
        deduped.set(record.collar_id, record);
    }
    const allAnomalyRecords = Array.from(deduped.values());

    const totalAnimals = animalsList.length;
    const anomaliesCount = allAnomalyRecords.length;
    const atRiskCount = aiAnalysis?.riskAnimalIds?.length ?? 0;

    return (
        <div className="space-y-5 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="w-7 h-7 text-orange-500" />
                        Registre d'Anomalies
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                        Suivi automatique des anomalies détectées avec analyse IA en temps réel
                    </p>
                </div>
                <Button
                    variant="primary"
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Analyse...' : 'Actualiser'}
                </Button>
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Dernière mise à jour</span>
                        <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                        {lastDataUpdate?.toLocaleTimeString('fr-FR') || 'En attente...'}
                    </p>
                    {lastDataUpdate && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{timeAgo(lastDataUpdate, now)}</p>
                    )}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Animaux: <strong className="text-gray-900 dark:text-white">{totalAnimals}</strong>
                        {' · '}
                        Anomalies: <strong className="text-gray-900 dark:text-white">{anomaliesCount}</strong>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Dernière analyse IA</span>
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                        {lastAIUpdate?.toLocaleTimeString('fr-FR') || 'Non disponible'}
                    </p>
                    {lastAIUpdate && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{timeAgo(lastAIUpdate, now)}</p>
                    )}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Analysés: <strong className="text-gray-900 dark:text-white">{totalAnimals}</strong>
                    </div>
                </div>

                <div className={`rounded-xl p-5 border shadow-sm ${aiAnalysis ? getRiskLevelColor(aiAnalysis.riskLevel) : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'}`}>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Niveau de risque global
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        {aiAnalysis?.riskLevel || 'N/A'}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Animaux à risque: <strong className="text-gray-900 dark:text-white">{atRiskCount}</strong>
                    </div>
                </div>
            </div>

            {/* AI Summary */}
            {aiAnalysis && (
                <div className={`rounded-lg p-4 border-2 ${getRiskLevelColor(aiAnalysis.riskLevel)}`}>
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Analyse IA</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{aiAnalysis.summary}</p>
                    {aiAnalysis.suggestions.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Recommandations :</h3>
                            <ul className="list-disc list-inside space-y-1">
                                {aiAnalysis.suggestions.map((suggestion, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                        {suggestion}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Anomaly Records Table */}
            {allAnomalyRecords.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Animal</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Santé</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Batterie</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Température</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fréq. cardiaque</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Activité</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Heure</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {allAnomalyRecords.map((record, idx) => (
                                <tr
                                    key={`${record.collar_id}-${idx}`}
                                    className={`transition-colors ${record.isAtRisk
                                        ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-red-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{record.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{record.collar_id}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthBadge(record.health)}`}>
                                            {record.health}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {record.battery !== null ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${record.battery > 50
                                                            ? 'bg-green-500'
                                                            : record.battery > 20
                                                                ? 'bg-yellow-500'
                                                                : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${record.battery}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {record.battery}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {record.temperature !== null
                                            ? `${record.temperature.toFixed(1)} °C`
                                            : <span className="text-gray-400">—</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {record.bpm !== null && record.bpm > 0
                                            ? `${record.bpm} bpm`
                                            : <span className="text-gray-400">—</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {activityLabel(record.activity)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-mono">{now.toLocaleTimeString('fr-FR')}</span>
                                        <span className="block text-xs text-gray-400 dark:text-gray-500">en direct</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center py-12">
                    <AlertTriangle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Aucune anomalie détectée</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Les anomalies apparaîtront ici en temps réel</p>
                </div>
            )}
        </div>
    );
};

export default AnomalyRegistry;
