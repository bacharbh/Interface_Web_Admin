import React, { useEffect, useState } from 'react';
import { Brain, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../../services/api';

interface Animal {
    collar_id: string;
    name: string;
    heartRate?: number;
    temperature?: number;
    activity?: number;
    health?: string;
    battery?: number;
    gps_signal?: number;
    [key: string]: any;
}

interface AnalysisData {
    summary: string;
    riskLevel: string;
    riskAnimalIds: string[];
    suggestions: string[];
}

interface AnalysisResponse {
    success: boolean;
    data?: AnalysisData;
    fallback?: boolean;
    model_mode?: 'anthropic' | 'local' | 'local-cache';
    confidence?: number;
    error?: string;
}

interface Props {
    animals: Animal[];
}

export default function AIAnalysis({ animals }: Props) {
    const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);
    const [confidence, setConfidence] = useState(0);
    const [modelMode, setModelMode] = useState<AnalysisResponse['model_mode']>('anthropic');
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;
        const controller = new AbortController();

        const doFetch = async () => {
            try {
                setLoading(true);
                setAiError(null);
                const { data } = await api.post<AnalysisResponse>(
                    '/ai/analyze',
                    { animals },
                    {
                        signal: controller.signal,
                        timeout: 20000,
                    }
                );
                if (data.success && data.data) {
                    setAnalysis(data.data);
                    setIsFallback(!!data.fallback);
                    setModelMode(data.model_mode || (data.fallback ? 'local' : 'anthropic'));
                    setConfidence(data.confidence ?? (data.fallback ? 0.85 : 0.95));
                } else {
                    throw new Error(data.error || 'Invalid analysis response');
                }
            } catch (err) {
                if ((err as any)?.name === 'CanceledError' || (err as any)?.code === 'ERR_CANCELED') return;
                console.error('AIAnalysis error', err);

                const status = (err as any)?.response?.status;
                const msg = status === 500
                    ? 'Service IA indisponible. Vérifiez que le backend est démarré.'
                    : status === 404
                        ? 'Endpoint /api/ai/analyze introuvable. Vérifiez server.js.'
                        : (err as any)?.message || "Erreur lors de l'analyse IA";
                setAiError(msg);
                setAnalysis(null);
            } finally {
                setLoading(false);
            }
        };

        if (animals.length > 0) {
            timer = setTimeout(doFetch, 800);
        } else {
            setAnalysis(null);
            setLoading(false);
        }

        return () => {
            if (timer) clearTimeout(timer);
            controller.abort();
        };
    }, [animals.length, animals.map(a => a.collar_id).join(','), retryToken]);

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'CRITICAL':
                return 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/50';
            case 'HIGH':
                return 'bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/50';
            case 'MEDIUM':
                return 'bg-yellow-100 dark:bg-yellow-500/20 border-yellow-300 dark:border-yellow-500/50';
            default:
                return 'bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-500/50';
        }
    };

    const getRiskIcon = (level: string) => (level === 'CRITICAL' || level === 'HIGH' ? '⚠️' : level === 'MEDIUM' ? '⚡' : '✅');

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-sm border border-purple-200 dark:border-purple-500/30 p-6 space-y-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="title-sm text-gray-900 dark:text-white">Analyse comparative IA</h3>
                        <p className="label-xs text-gray-500 dark:text-gray-400">
                            {modelMode === 'anthropic' ? '🧠 Powered by Claude' : modelMode === 'local-cache' ? '🤖 Mode local mis en cache' : '🤖 Intelligence locale'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Confiance: {(confidence * 100).toFixed(0)}%</span>
                    <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full label-xs font-bold ${loading ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300' : aiError ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' : isFallback ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader className="w-3 h-3 animate-spin" /> Analyse…
                            </>
                        ) : aiError ? (
                            <>
                                <AlertCircle className="w-3 h-3" /> Erreur
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-3 h-3" /> {isFallback ? 'Local' : 'IA'}
                            </>
                        )}
                    </span>
                </div>
            </div>

            {aiError ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                            <span className="text-sm leading-none">⚠️</span>
                            <p className="text-xs text-red-600 dark:text-red-300">{aiError}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRetryToken(token => token + 1)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
                        >
                            Réessayer
                        </button>
                    </div>
                </div>
            ) : analysis ? (
                <div className="space-y-4">
                    <div className={`p-3 rounded-lg border ${getRiskColor(analysis.riskLevel)}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{getRiskIcon(analysis.riskLevel)}</span>
                            <span className="font-bold text-gray-900 dark:text-white">Niveau de risque: {analysis.riskLevel}</span>
                        </div>
                    </div>

                    <p className="body-sm text-gray-700 dark:text-gray-300 leading-relaxed">{analysis.summary}</p>

                    {analysis.riskAnimalIds && analysis.riskAnimalIds.length > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30">
                            <p className="label-xs font-bold text-red-700 dark:text-red-400 mb-2">Animaux à surveiller:</p>
                            <div className="flex flex-wrap gap-2">
                                {analysis.riskAnimalIds.map(id => {
                                    const animal = animals.find(a => a.collar_id === id);
                                    return (
                                        <span key={id} className="px-2 py-1 bg-red-200 dark:bg-red-500/30 text-red-900 dark:text-red-200 rounded text-xs font-bold">
                                            {animal?.name || id}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {analysis.suggestions && analysis.suggestions.length > 0 && (
                        <div className="space-y-2">
                            <p className="label-xs font-bold text-gray-700 dark:text-gray-300">Recommandations:</p>
                            <ul className="space-y-1">
                                {analysis.suggestions.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-2">
                                        <span className="flex-shrink-0">→</span>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center justify-center py-8">
                    <Loader className="w-5 h-5 animate-spin text-purple-500" />
                </div>
            )}

            <div className="pt-2 border-t border-purple-200 dark:border-purple-500/20">
                <p className="text-xs text-gray-500 dark:text-gray-400">💡 Conseil: Validez l'analyse avec un vétérinaire avant action. Les données IA complètent, ne remplacent pas, le diagnostic professionnel.</p>
                {isFallback && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">📌 Utilisation du mode analyse locale. Pour des analyses Claude avancées, configurez ANTHROPIC_API_KEY.</p>
                )}
                {modelMode && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Mode IA: {modelMode}</p>
                )}
            </div>
        </div>
    );
}

