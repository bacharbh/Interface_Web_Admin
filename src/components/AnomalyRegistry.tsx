import React, { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Clock, TrendingUp } from 'lucide-react';
import Button from './ui/Button';
import { useRealtimePositions } from '../hooks/useRealtimePositions';
import api from '../services/api';

interface AnomalyRecord {
    collar_id: string;
    name: string;
    bpm: number;
    temperature: number;
    activity: number;
    health: string;
    battery: number;
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

const AnomalyRegistry: React.FC = () => {
    const { animalsList } = useRealtimePositions([]);
    const [anomalyRecords, setAnomalyRecords] = useState<AnomalyRecord[]>([]);
    const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
    const [lastAIUpdate, setLastAIUpdate] = useState<Date | null>(null);
    const anomaliesRef = useRef<Map<string, number>>(new Map()); // Track anomaly history
    const lastAIRequestAtRef = useRef<number>(0);
    const lastAIRequestSignatureRef = useRef<string>('');
    const aiRequestInFlightRef = useRef(false);
    const lastAnomalySignatureRef = useRef<string>('');
    const lastPersistedAnomalySignatureRef = useRef<string>('');
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    const { data: persistedAnomalies = [] } = useQuery<PersistedAnomaly[]>({
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

    // Reactive anomaly tracking - updates immediately when store changes
    useEffect(() => {
        if (animalsList.length === 0) return;

        // Filter and map animals with health issues or critical battery
        const problematicAnimals = animalsList.filter(animal =>
            animal.health === 'Critical' ||
            animal.health === 'Warning' ||
            (animal.battery ?? 100) < 20 ||
            (animal.temperature ?? 38) > 40 ||
            (animal.temperature ?? 38) < 37
        );

        const newRecords: AnomalyRecord[] = problematicAnimals.map((animal, index) => {
            const collarId = animal.collar_id || animal.id || `collar_${index}`;
            const battery = animal.battery ?? 0;
            const temperature = animal.temperature ?? 0;
            const heartRate = animal.heartRate ?? 0;
            const activity = animal.activity ?? 0;

            // Track anomaly score
            const anomalyScore =
                (animal.health === 'Critical' ? 30 : animal.health === 'Warning' ? 15 : 0) +
                (battery < 20 ? 20 : battery < 50 ? 10 : 0) +
                (temperature > 39 || temperature < 37 ? 15 : 0) +
                (heartRate > 120 || heartRate < 40 ? 25 : 0);

            anomaliesRef.current.set(collarId, anomalyScore);

            return {
                collar_id: collarId,
                name: animal.name || `Animal #${collarId.slice(-4)}`,
                bpm: heartRate,
                temperature: temperature,
                activity: activity,
                health: animal.health || 'Unknown',
                battery: battery,
                timestamp: new Date().toLocaleTimeString('fr-FR'),
                isAtRisk: animal.health === 'Critical' || Boolean(aiAnalysis?.riskAnimalIds?.includes(collarId)),
            };
        });

        const signature = newRecords
            .map(record => `${record.collar_id}:${record.health}:${record.battery}:${record.temperature}:${record.bpm}:${record.activity}:${record.isAtRisk ? 1 : 0}`)
            .join('|');

        // Avoid writing state if nothing meaningful changed; this prevents render loops.
        if (signature !== lastAnomalySignatureRef.current) {
            lastAnomalySignatureRef.current = signature;
            setAnomalyRecords(newRecords);
            setLastDataUpdate(new Date());

            if (newRecords.length > 0 && signature !== lastPersistedAnomalySignatureRef.current) {
                void persistAnomalies(newRecords, signature);
            }
        }
    }, [animalsSignature, aiRiskSignature]);

    // Call AI analysis asynchronously (doesn't block simulation updates)
    useEffect(() => {
        if (animalsList.length === 0) return;

        // Debounce AI calls - only call every 5-10 seconds
        const aiTimer = setTimeout(async () => {
            if (aiRequestInFlightRef.current) return;

            const now = Date.now();
            if (now - lastAIRequestAtRef.current < 30000) return;

            const signature = animalsList
                .map(animal => `${animal.collar_id || animal.id || 'na'}:${animal.health || 'Unknown'}:${animal.battery ?? 0}:${animal.temperature ?? 0}:${animal.heartRate ?? 0}`)
                .sort()
                .join('|');

            if (signature === lastAIRequestSignatureRef.current) return;

            console.debug('[AnomalyRegistry] animalsList.length =', animalsList.length);
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

                console.debug('[AnomalyRegistry] POST /api/ai/analyze payload size:', payload.animals.length);
                const response = await api.post('/ai/analyze', payload, { timeout: 12000 });
                console.debug('[AnomalyRegistry] AI analyze response', response?.data);

                if (response?.data) {
                    const data = response.data;
                    if (data.success && data.data) {
                        setAiAnalysis(data.data);
                        setLastAIUpdate(new Date());
                    } else if (data.fallback && data.data) {
                        // local AI fallback returned structured data
                        setAiAnalysis(data.data);
                        setLastAIUpdate(new Date());
                    } else {
                        console.warn('[AnomalyRegistry] AI analyze returned no usable data', data);
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
        }, 500); // Small debounce to avoid blocking

        return () => clearTimeout(aiTimer);
    }, [animalsSignature]);

    // Auto-refresh anomaly data every 5 seconds for real-time updates
    useEffect(() => {
        refreshTimerRef.current = setInterval(() => {
            // Force a refresh by updating timestamp
            setLastDataUpdate(new Date());
        }, 5000);

        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, []);

    const getRiskLevelColor = (level?: string) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
            case 'HIGH': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
            case 'MEDIUM': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
            case 'LOW': return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
            default: return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
        }
    };

    const getHealthColor = (health: string) => {
        switch (health) {
            case 'Good': return 'text-green-600 dark:text-green-400';
            case 'Warning': return 'text-orange-600 dark:text-orange-400';
            case 'Critical': return 'text-red-600 dark:text-red-400';
            default: return 'text-gray-600 dark:text-gray-400';
        }
    };

    const persistedAnomalyRecords: AnomalyRecord[] = persistedAnomalies.map((anomaly, index) => ({
        collar_id: anomaly.animalId || anomaly.collar_id || anomaly._id || `persisted_${index}`,
        name: anomaly.name || anomaly.animalId || anomaly.collar_id || `Anomalie ${index + 1}`,
        bpm: anomaly.features?.heartRate ?? 0,
        temperature: anomaly.features?.temperature ?? 0,
        activity: anomaly.features?.movementRate ?? 0,
        health: anomaly.resolved ? 'Resolved' : 'Warning',
        battery: 0,
        timestamp: anomaly.detectedAt || anomaly.timestamp || new Date().toISOString(),
        isAtRisk: !anomaly.resolved,
    }));

    const allAnomalyRecords = [...persistedAnomalyRecords, ...anomalyRecords];
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
                <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setAnomalyRecords([])} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        {isLoading ? 'Analyse...' : 'Actualiser'}
                    </Button>
                </div>
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Dernière mise à jour
                        </span>
                        <Clock className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {lastDataUpdate?.toLocaleTimeString('fr-FR') || 'En attente...'}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total animaux: <strong className="text-gray-900 dark:text-white">{totalAnimals}</strong> | Anomalies: <strong className="text-gray-900 dark:text-white">{anomaliesCount}</strong>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Dernière analyse IA
                        </span>
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                    </div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {lastAIUpdate?.toLocaleTimeString('fr-FR') || 'Non disponible'}
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Analysés: <strong className="text-gray-900 dark:text-white">{totalAnimals}</strong>
                    </div>
                </div>

                <div className={`rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm ${aiAnalysis ? getRiskLevelColor(aiAnalysis.riskLevel) : 'bg-gray-100 dark:bg-gray-800'}`}>
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
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Recommandations:</h3>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Animal</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Santé</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Batterie</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Température</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Fréquence cardiaque</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Activité</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Heure</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {allAnomalyRecords.map((record) => (
                            <tr
                                key={record.collar_id}
                                className={`transition-colors ${record.isAtRisk
                                    ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-red-500'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                <td className="px-6 py-4">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{record.name}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{record.collar_id}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`font-medium ${getHealthColor(record.health)}`}>
                                        {record.health}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
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
                                        <span className="text-sm font-medium text-gray-900 dark:text-white w-8">
                                            {record.battery}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {(record.temperature ?? 0).toFixed(1)}°C
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {record.bpm} bpm
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                    {record.activity}%
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {record.timestamp}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {allAnomalyRecords.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400">
                        En attente des données...
                    </p>
                </div>
            )}
        </div>
    );
};

export default AnomalyRegistry;
