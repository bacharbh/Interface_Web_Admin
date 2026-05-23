/**
 * Example: How to use real-time AI analysis in Dashboard components
 * 
 * This file shows patterns for integrating AI analysis data into:
 * - Alert banner (main health status)
 * - Health score (global KPI)
 * - AI Insights section
 * 
 * All components automatically re-render when aiAlerts changes in the store
 */

import { useIoTStore } from '../../hooks/useIoTStore';

/**
 * Example 1: Alert Banner Component
 * Shows the latest AI analysis as a prominent alert
 */
export function AlertBanner() {
    const aiAlerts = useIoTStore(state => state.aiAlerts);

    const latestAIAnalysis = aiAlerts.find(a => a.type === 'ai-analysis');

    if (!latestAIAnalysis) return null;

    const getRiskColor = (level) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700';
            case 'HIGH': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
            case 'MEDIUM': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700';
            default: return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
        }
    };

    const getRiskIcon = (level) => {
        switch (level) {
            case 'CRITICAL': return '🚨';
            case 'HIGH': return '⚠️';
            case 'MEDIUM': return '⚡';
            default: return '✅';
        }
    };

    return (
        <div className={`p-4 rounded-lg border ${getRiskColor(latestAIAnalysis.riskLevel)}`}>
            <div className="flex items-start gap-3">
                <span className="text-2xl">{getRiskIcon(latestAIAnalysis.riskLevel)}</span>
                <div className="flex-1">
                    <h3 className="font-bold mb-1">Analyse du troupeau</h3>
                    <p className="text-sm mb-3">{latestAIAnalysis.message}</p>
                    {latestAIAnalysis.suggestions && latestAIAnalysis.suggestions.length > 0 && (
                        <div className="text-xs space-y-1">
                            <p className="font-semibold">Recommandations:</p>
                            <ul className="list-disc list-inside space-y-1">
                                {latestAIAnalysis.suggestions.map((suggestion, idx) => (
                                    <li key={idx}>{suggestion}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Example 2: Health Score Component
 * Updates the global health KPI based on AI risk level
 */
export function HealthScoreCard() {
    const aiAlerts = useIoTStore(state => state.aiAlerts);
    const devices = useIoTStore(state => state.devices);

    const latestAIAnalysis = aiAlerts.find(a => a.type === 'ai-analysis');

    // Calculate health score from AI risk level
    let healthScore = 100;
    if (latestAIAnalysis) {
        const riskScores = {
            'LOW': 90,
            'MEDIUM': 70,
            'HIGH': 40,
            'CRITICAL': 20
        };
        healthScore = riskScores[latestAIAnalysis.riskLevel] || 100;
    }

    // Fallback: calculate from device health
    if (!latestAIAnalysis) {
        const totalDevices = Object.keys(devices).length;
        if (totalDevices > 0) {
            const criticalCount = Object.values(devices).filter(d => d?.health === 'Critical').length;
            const warningCount = Object.values(devices).filter(d => d?.health === 'Warning').length;
            healthScore = 100 - (criticalCount * 30 + warningCount * 10);
        }
    }

    return (
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Santé du troupeau</p>
            <div className="flex items-end gap-4">
                <div>
                    <div className="text-4xl font-bold">{Math.round(healthScore)}</div>
                    <p className="text-xs text-gray-500">/ 100</p>
                </div>
                <div className="flex-1">
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${healthScore >= 70 ? 'bg-green-500' :
                                    healthScore >= 50 ? 'bg-yellow-500' :
                                        healthScore >= 30 ? 'bg-orange-500' :
                                            'bg-red-500'
                                }`}
                            style={{ width: `${healthScore}%` }}
                        />
                    </div>
                </div>
            </div>
            {latestAIAnalysis && (
                <p className="text-xs text-gray-500 mt-2">
                    Dernière analyse: {new Date(latestAIAnalysis.timestamp).toLocaleTimeString('fr-FR')}
                </p>
            )}
        </div>
    );
}

/**
 * Example 3: AI Insights Section
 * Shows structured AI analysis data in detail
 */
export function AIInsightsSection() {
    const aiAlerts = useIoTStore(state => state.aiAlerts);
    const devices = useIoTStore(state => state.devices);

    const latestAIAnalysis = aiAlerts.find(a => a.type === 'ai-analysis');

    if (!latestAIAnalysis) {
        return (
            <div className="p-4 text-center text-gray-500 text-sm">
                En attente de la première analyse...
            </div>
        );
    }

    const getRiskAnimals = () => {
        if (!latestAIAnalysis.riskAnimalIds) return [];
        return latestAIAnalysis.riskAnimalIds
            .map(id => devices[id])
            .filter(Boolean);
    };

    return (
        <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-sm mb-2">Analyse IA</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{latestAIAnalysis.message}</p>
            </div>

            {getRiskAnimals().length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="font-semibold text-sm mb-3">Animaux à surveiller</p>
                    <div className="space-y-2">
                        {getRiskAnimals().map(animal => (
                            <div key={animal.collar_id} className="flex items-center justify-between text-sm p-2 bg-white dark:bg-gray-800 rounded">
                                <span>{animal.name}</span>
                                <span className="text-xs text-gray-500">#{animal.collar_id}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {latestAIAnalysis.suggestions && latestAIAnalysis.suggestions.length > 0 && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <p className="font-semibold text-sm mb-3">Recommandations</p>
                    <ul className="space-y-2">
                        {latestAIAnalysis.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="flex gap-2 text-sm">
                                <span className="text-green-600 dark:text-green-400">✓</span>
                                <span>{suggestion}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-xs text-gray-500 text-center">
                Analysé le {new Date(latestAIAnalysis.timestamp).toLocaleString('fr-FR')}
            </p>
        </div>
    );
}

export default { AlertBanner, HealthScoreCard, AIInsightsSection };
