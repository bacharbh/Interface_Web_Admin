import React, { useMemo } from 'react';
import { useIoTStore } from '../../hooks/useIoTStore';
import { AlertTriangle } from 'lucide-react';

const LSTMAlertBanner = () => {
    const devices = useIoTStore(state => state.devices);
    const isConnected = useIoTStore(state => state.isConnected);
    const isOfflineData = useIoTStore(state => state.isOfflineData);

    const criticalAnimals = useMemo(() => {
        if (!isConnected && !isOfflineData) return [];
        return Object.values(devices)
            .filter(animal =>
                animal &&
                animal.lstm_score &&
                animal.lstm_score > 75
            )
            .map(animal => ({
                collar_id: animal.collar_id,
                name: animal.name,
                lstm_score: Math.round(animal.lstm_score || 0),
                lstm_anomaly_type: animal.lstm_anomaly_type || 'UNKNOWN',
                health: animal.health,
                temperature: animal.temperature,
                heartRate: animal.heartRate,
            }))
            .sort((a, b) => (b.lstm_score || 0) - (a.lstm_score || 0));
    }, [devices]);

    const getAnomalyLabel = (type) => {
        const labels = {
            'ARRHYTHMIA': 'Arythmie',
            'FEVER': 'Fievre',
            'LETHARGY': 'Lethargie',
            'ABNORMAL_MOVEMENT': 'Mouvement anormal',
            'STRESS': 'Stress',
            'UNKNOWN': 'Anomalie',
        };
        return labels[type] || 'Anomalie';
    };

    const getAnomalyColor = (score) => {
        if (score >= 90) return 'from-red-600 to-red-500';
        if (score >= 80) return 'from-red-500 to-orange-500';
        return 'from-orange-500 to-orange-400';
    };

    if (criticalAnimals.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 pt-4 px-4">
            <div className="max-w-7xl mx-auto space-y-2">
                {criticalAnimals.map((alert) => (
                    <div
                        key={alert.collar_id}
                        className={`bg-gradient-to-r ${getAnomalyColor(alert.lstm_score)} text-white rounded-lg shadow-2xl overflow-hidden`}
                    >
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4 flex-1">
                                <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <h3 className="font-bold text-lg">{alert.name}</h3>
                                        <span className="text-sm opacity-90">#{alert.collar_id}</span>
                                    </div>
                                    <p className="text-sm opacity-90">
                                        {getAnomalyLabel(alert.lstm_anomaly_type)} - Score LSTM: {alert.lstm_score}%
                                    </p>
                                </div>
                                <div className="text-xs opacity-90 hidden sm:flex gap-4">
                                    {alert.temperature && <span>Temp: {alert.temperature}C</span>}
                                    {alert.heartRate && <span>HR: {alert.heartRate} bpm</span>}
                                </div>
                            </div>
                        </div>
                        <div className="h-1 bg-white/30">
                            <div
                                className="h-full bg-white transition-all duration-500"
                                style={{ width: `${Math.min(alert.lstm_score, 100)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LSTMAlertBanner;
