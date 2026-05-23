import React, { useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { IAnimal } from '../../types';

interface LSTMAlertBannerProps {
    animals: IAnimal[];
    onDismiss?: (collarId: string) => void;
}

/**
 * LSTMAlertBanner — Displays real-time LSTM anomaly detection alerts
 * Shows animals with LSTM score > 75, displaying their ID and anomaly type
 * Updates automatically as simulation data changes
 */
export const LSTMAlertBanner: React.FC<LSTMAlertBannerProps> = ({ animals, onDismiss }) => {
    // Filter animals with high LSTM scores
    const anomalousAnimals = useMemo(() => {
        return animals
            .filter(animal => (animal.lstm_score ?? 0) > 75)
            .sort((a, b) => (b.lstm_score ?? 0) - (a.lstm_score ?? 0));
    }, [animals]);

    if (anomalousAnimals.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 bg-red-600 dark:bg-red-900 text-white shadow-lg z-40 animate-in">
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <AlertTriangle className="w-6 h-6 mt-0.5 flex-shrink-0 text-red-200" />
                        <div className="flex-1">
                            <h2 className="font-bold text-lg mb-2">
                                ⚠️ Détection d'Anomalies LSTM ({anomalousAnimals.length})
                            </h2>

                            <div className="space-y-2">
                                {anomalousAnimals.map((animal) => (
                                    <div
                                        key={animal.collar_id}
                                        className="flex items-center justify-between bg-red-700 dark:bg-red-800 px-3 py-2 rounded"
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="font-mono font-bold text-lg bg-red-500 dark:bg-red-700 px-2 py-1 rounded">
                                                {animal.collar_id}
                                            </span>
                                            <div>
                                                <p className="font-medium">{animal.name}</p>
                                                {animal.lstm_anomaly_type && (
                                                    <p className="text-sm text-red-100">
                                                        {animal.lstm_anomaly_type}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="ml-auto text-right">
                                                <p className="text-sm font-semibold">
                                                    Score: {animal.lstm_score}%
                                                </p>
                                                {animal.health === 'Critical' && (
                                                    <p className="text-xs text-red-100">🔴 Critique</p>
                                                )}
                                                {animal.health === 'Warning' && (
                                                    <p className="text-xs text-yellow-100">🟡 Avertissement</p>
                                                )}
                                            </div>
                                        </div>
                                        {onDismiss && (
                                            <button
                                                onClick={() => onDismiss(animal.collar_id)}
                                                className="ml-2 p-1 hover:bg-red-600 dark:hover:bg-red-700 rounded transition-colors"
                                                title="Dismiss"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 text-sm text-red-100">
                                📊 Ces animaux présentent des anomalies détectées par le modèle LSTM.
                                Veuillez les inspecter rapidement pour évaluer leur état de santé.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LSTMAlertBanner;
