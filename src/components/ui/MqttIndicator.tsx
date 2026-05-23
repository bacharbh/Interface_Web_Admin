import React from 'react';
import { Wifi, WifiOff, Radio } from 'lucide-react';
import { useMqtt } from '../../contexts/MqttContext';

interface MqttIndicatorProps {
    className?: string;
}

export const MqttIndicator: React.FC<MqttIndicatorProps> = ({ className = '' }) => {
    const { isConnected, isSimulation, brokerUrl, brokerMode } = useMqtt();

    if (isSimulation) {
        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 ${className}`} title="Mode simulation">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-sm" />
                <span className="label-xs font-medium text-amber-700 dark:text-amber-300">Mode simulation</span>
            </div>
        );
    }

    const brokerDisplay = brokerMode === 'local' ? 'Broker local' : 'Broker distant';
    const brokerUrl_shortened = brokerUrl.replace('ws://', '').replace('wss://', '').split(':')[0];

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isConnected
                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30'
                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30'
                } ${className}`}
            title={`MQTT: ${isConnected ? 'Connecté' : 'Déconnecté'} - ${brokerUrl_shortened}`}
        >
            {isConnected ? (
                <>
                    <Wifi className="w-4 h-4 text-green-600 dark:text-green-400 animate-pulse" />
                    <span className="label-xs font-medium text-green-700 dark:text-green-300">
                        {brokerDisplay}
                    </span>
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="label-xs font-medium text-red-700 dark:text-red-300">
                        Déconnecté
                    </span>
                </>
            )}
        </div>
    );
};

export default MqttIndicator;
