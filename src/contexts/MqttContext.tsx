import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { connectMqtt } from '../services/mqttService';
import { useAuth } from './AuthContext';
import { useIoTStore, queueIoTUpdate, Alert } from '../hooks/useIoTStore';
import { startSimulation, stopSimulation } from '../utils/simulation';
import { notificationService } from '../services/notificationService';
import { MqttClient } from 'mqtt';

interface MqttContextType {
  client: MqttClient | null;
  isConnected: boolean;
  isSimulation: boolean;
  toggleSimulation: () => void;
  brokerUrl: string;
  brokerMode: 'local' | 'remote';
}

const MqttContext = createContext<MqttContextType | undefined>(undefined);

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) throw new Error('useMqtt must be used within MqttProvider');
  return context;
};

export const MqttProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isSimulation, setSimulation, setConnected, addAlert } = useIoTStore();

  const clientRef = useRef<MqttClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);

  const [clientState, setClientState] = useState<MqttClient | null>(null);
  const [internalConnected, setInternalConnected] = useState(false);

  // Get broker URL and mode from environment
  const brokerUrl = import.meta.env.VITE_MQTT_URL || 'ws://localhost:1883';
  const brokerMode = import.meta.env.VITE_MQTT_MODE === 'remote' ? 'remote' : 'local' as const;

  // Sync simulation lifecycle
  useEffect(() => {
    if (isSimulation) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return () => stopSimulation();
  }, [isSimulation]);

  // Real MQTT Logic
  useEffect(() => {
    isUnmountedRef.current = false;

    const connectWithBackoff = () => {
      if (isUnmountedRef.current || isSimulation || !user) return;

      console.info('[MqttProvider] Attempting MQTT connect to', brokerUrl);
      const mqttClient = connectMqtt('admin', 'admin_password');
      clientRef.current = mqttClient;
      setClientState(mqttClient);

      const handleConnect = () => {
        if (isUnmountedRef.current) return;
        console.info('[MqttProvider] MQTT connected to', brokerUrl);
        setInternalConnected(true);
        setConnected(true);
        reconnectAttemptRef.current = 0; // Reset attempts on successful connection
        mqttClient.subscribe('collar/+/gps', { qos: 0 });
        mqttClient.subscribe('alerts/+', { qos: 1 });
      };

      const handleMessage = (topic: string, message: Buffer) => {
        if (isUnmountedRef.current) return;
        try {
          const data = JSON.parse(message.toString());

          if (topic.startsWith('collar/')) {
            queueIoTUpdate(data.collar_id, {
              ...data,
              lastUpdate: new Date().toLocaleTimeString()
            });
          } else if (topic.startsWith('alerts/')) {
            const newAlert: Alert = { ...data, id: Date.now(), read: false, source: 'mqtt' };
            addAlert(newAlert);
            notificationService.playNotification(newAlert.severity === 'CRITICAL' ? 'critical' : 'default');
          }
        } catch (e) {
          console.error('MQTT Parse Error', e);
        }
      };

      const handleDisconnectOrError = () => {
        if (isUnmountedRef.current) return;
        console.info('[MqttProvider] MQTT disconnected from', brokerUrl);
        setInternalConnected(false);
        setConnected(false);
        scheduleReconnect();
      };

      mqttClient.on('connect', handleConnect);
      mqttClient.on('message', handleMessage);
      mqttClient.on('error', handleDisconnectOrError);
      mqttClient.on('close', handleDisconnectOrError);
    };

    const scheduleReconnect = () => {
      if (isUnmountedRef.current) return;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      const backoffTime = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000); // Max 30 seconds
      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        cleanupClient();
        connectWithBackoff();
      }, backoffTime);
    };

    const cleanupClient = () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        clientRef.current.end(true); // force close
        clientRef.current = null;
        setClientState(null);
      }
    };

    const cleanup = () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      cleanupClient();
      setInternalConnected(false);
      setConnected(false);
    };

    if (user && !isSimulation) {
      connectWithBackoff();
    }

    return cleanup;
  }, [user, isSimulation, setConnected, addAlert]);

  const toggleSimulation = useCallback(() => {
    setSimulation(!isSimulation);
  }, [isSimulation, setSimulation]);

  return (
    <MqttContext.Provider value={{
      client: clientState,
      isConnected: isSimulation ? true : internalConnected,
      isSimulation,
      toggleSimulation,
      brokerUrl,
      brokerMode
    }}>
      {children}
    </MqttContext.Provider>
  );
};
