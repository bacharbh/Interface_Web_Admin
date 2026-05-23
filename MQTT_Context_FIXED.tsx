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
  reconnect: () => void;
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
  const [client, setClient] = useState<MqttClient | null>(null);
  const [internalConnected, setInternalConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef<MqttClient | null>(null);

  // Cleanup function with proper memory management
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (clientRef.current) {
      // Remove all event listeners to prevent memory leaks
      clientRef.current.removeAllListeners();
      clientRef.current.end();
      clientRef.current = null;
      setClient(null);
      setInternalConnected(false);
      setConnected(false);
    }
  }, [setConnected]);

  // Reconnect function with exponential backoff
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;
    
    const delay = Math.min(1000 * Math.pow(2, Math.floor(Math.random() * 3)), 30000);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (user && !isSimulation) {
        initializeMqtt();
      }
    }, delay);
  }, [user, isSimulation]);

  // Initialize MQTT connection with proper error handling
  const initializeMqtt = useCallback(() => {
    try {
      cleanup();
      
      const mqttClient = connectMqtt('admin', 'admin_password');
      clientRef.current = mqttClient;

      const onConnect = () => {
        setInternalConnected(true);
        setConnected(true);
        setClient(mqttClient);
        
        // Subscribe to topics with error handling
        const subscriptions = [
          { topic: 'collar/+/gps', qos: 0 },
          { topic: 'alerts/+', qos: 1 }
        ];

        subscriptions.forEach(({ topic, qos }) => {
          mqttClient.subscribe(topic, { qos }, (err) => {
            if (err) {
              console.error(`Failed to subscribe to ${topic}:`, err);
            }
          });
        });
      };

      const onMessage = (topic: string, message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (topic.startsWith('collar/')) {
            queueIoTUpdate(data.collar_id, {
              ...data,
              lastUpdate: new Date().toLocaleTimeString()
            });
          } else if (topic.startsWith('alerts/')) {
            const newAlert: Alert = { ...data, id: Date.now(), read: false };
            addAlert(newAlert);
            notificationService.playNotification(newAlert.severity === 'CRITICAL' ? 'critical' : 'default');
          }
        } catch (e) {
          console.error('MQTT Parse Error:', e);
        }
      };

      const onError = (error: Error) => {
        console.error('MQTT Error:', error);
        setInternalConnected(false);
        setConnected(false);
        reconnect();
      };
      
      const onClose = () => {
        console.warn('MQTT Connection closed');
        setInternalConnected(false);
        setConnected(false);
        reconnect();
      };

      const onOffline = () => {
        console.warn('MQTT Client offline');
        setInternalConnected(false);
        setConnected(false);
      };

      // Add event listeners
      mqttClient.on('connect', onConnect);
      mqttClient.on('message', onMessage);
      mqttClient.on('error', onError);
      mqttClient.on('close', onClose);
      mqttClient.on('offline', onOffline);

    } catch (error) {
      console.error('Failed to initialize MQTT:', error);
      reconnect();
    }
  }, [cleanup, setConnected, addAlert, reconnect]);

  // Sync simulation lifecycle
  useEffect(() => {
    if (isSimulation) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return () => stopSimulation();
  }, [isSimulation]);

  // Real MQTT Logic with proper cleanup
  useEffect(() => {
    if (user && !isSimulation) {
      initializeMqtt();
    } else {
      cleanup();
    }

    return cleanup;
  }, [user, isSimulation, initializeMqtt, cleanup]);

  const toggleSimulation = useCallback(() => {
    setSimulation(!isSimulation);
  }, [isSimulation, setSimulation]);

  return (
    <MqttProvider value={{ 
      client: clientRef.current, 
      isConnected: isSimulation ? true : internalConnected, 
      isSimulation, 
      toggleSimulation,
      reconnect
    }}>
      {children}
    </MqttProvider>
  );
};
