import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { IAnimal, HealthStatus } from '../types';
import { saveData, loadData } from '../utils/persistence';

export interface AISettings {
  alertThresholds: {
    batteryCritical: number;
    temperatureCritical: number;
    immobilityMinutes: number;
  };
  pollingIntervalMinutes: number;
  notificationChannels: {
    toast: boolean;
    email: boolean;
    sms: boolean;
  };
  anomalyRules: {
    batteryCritical: boolean;
    temperatureCritical: boolean;
    immobility: boolean;
    outOfZone: boolean;
    signalLoss: boolean;
  };
}

const AI_SETTINGS_STORAGE_KEY = 'smart_shepherd_ai_settings_v1';

const DEFAULT_AI_SETTINGS: AISettings = {
  alertThresholds: {
    batteryCritical: 20,
    temperatureCritical: 40,
    immobilityMinutes: 30,
  },
  pollingIntervalMinutes: 5,
  notificationChannels: {
    toast: true,
    email: false,
    sms: false,
  },
  anomalyRules: {
    batteryCritical: true,
    temperatureCritical: true,
    immobility: true,
    outOfZone: true,
    signalLoss: true,
  },
};

const loadAISettings = (): AISettings => {
  if (typeof window === 'undefined') return DEFAULT_AI_SETTINGS;

  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;

    return {
      ...DEFAULT_AI_SETTINGS,
      ...JSON.parse(raw),
      alertThresholds: {
        ...DEFAULT_AI_SETTINGS.alertThresholds,
        ...(JSON.parse(raw).alertThresholds || {}),
      },
      notificationChannels: {
        ...DEFAULT_AI_SETTINGS.notificationChannels,
        ...(JSON.parse(raw).notificationChannels || {}),
      },
      anomalyRules: {
        ...DEFAULT_AI_SETTINGS.anomalyRules,
        ...(JSON.parse(raw).anomalyRules || {}),
      },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
};

const persistAISettings = (settings: AISettings) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

const getAlertNaturalKey = (alert: Alert) => [
  alert.type,
  alert.collar_id,
  alert.timestamp,
  alert.message ?? '',
  alert.animal_name ?? ''
].join('|');

export interface Alert {
  id: string | number;
  type: string;
  collar_id: string;
  animal_name: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  timestamp: string;
  read: boolean;
  readAt?: string;
  message?: string;
  source?: 'socket' | 'simulation' | 'mqtt';
}

interface IoTState {
  // Data
  devices: Record<string, IAnimal>;
  history: Record<string, IAnimal[]>;
  alerts: Alert[];

  // Connection Status
  isConnected: boolean;
  isSimulation: boolean;
  isOfflineData: boolean;

  // Actions
  setConnected: (status: boolean) => void;
  setSimulation: (status: boolean) => void;
  loadOfflineData: () => Promise<void>;

  // Atomic Updates
  setDevices: (devices: Record<string, IAnimal>) => void;
  setAlerts: (alerts: Alert[]) => void;
  upsertDevice: (device: Partial<IAnimal> & { collar_id: string }) => void;
  addAlert: (alert: Alert) => void;
  markAlertAsRead: (id: string | number) => void;
  markAllAlertsAsRead: () => void;

  // Batching (Internal use mostly)
  batchUpdateDevices: (updates: Record<string, Partial<IAnimal>>) => void;

  // Additional States
  aiAlerts: any[];
  needsCharging: string[];
  aiSettings: AISettings;
  setAIAlerts: (aiAlerts: any[]) => void;
  addAIAlert: (alert: any) => void;
  addToNeedsCharging: (deviceId: string) => void;
  removeFromNeedsCharging: (deviceId: string) => void;
  setAISettings: (settings: Partial<AISettings>) => void;
  resetAISettings: () => void;
}

// Internal buffer for batching GPS updates
let updateBuffer: Record<string, Partial<IAnimal>> = {};
let batchTimeout: NodeJS.Timeout | null = null;

export const useIoTStore = create<IoTState>()(
  subscribeWithSelector((set) => ({
    devices: {},
    history: {},
    alerts: [],
    aiAlerts: [],
    needsCharging: [],
    aiSettings: loadAISettings(),
    isConnected: false,
    isSimulation: false,
    isOfflineData: false,

    setConnected: (status) => set({ isConnected: status, isOfflineData: !status && !navigator.onLine }),
    setSimulation: () => set({ isSimulation: false }),

    loadOfflineData: async () => {
      const cachedDevices = await loadData('last_known_devices');
      const cachedAlerts = await loadData('last_known_alerts');
      if (cachedDevices || cachedAlerts) {
        set({
          devices: cachedDevices || {},
          alerts: cachedAlerts || [],
          isOfflineData: true
        });
      }
    },

    setDevices: (devices) => {
      set({ devices });
      saveData('last_known_devices', devices);
    },

    setAlerts: (alerts: Alert[]) => {
      set({ alerts });
      saveData('last_known_alerts', alerts);
    },

    setAIAlerts: (aiAlerts) => set({ aiAlerts }),

    addAIAlert: (alert) => set((state) => ({
      aiAlerts: [alert, ...state.aiAlerts].slice(0, 100)
    })),

    addToNeedsCharging: (deviceId) => set((state) => ({
      needsCharging: state.needsCharging.includes(deviceId)
        ? state.needsCharging
        : [...state.needsCharging, deviceId]
    })),

    removeFromNeedsCharging: (deviceId) => set((state) => ({
      needsCharging: state.needsCharging.filter(id => id !== deviceId)
    })),

    setAISettings: (settings) => set((state) => {
      const mergedSettings: AISettings = {
        ...state.aiSettings,
        ...settings,
        alertThresholds: {
          ...state.aiSettings.alertThresholds,
          ...(settings.alertThresholds || {}),
        },
        notificationChannels: {
          ...state.aiSettings.notificationChannels,
          ...(settings.notificationChannels || {}),
        },
        anomalyRules: {
          ...state.aiSettings.anomalyRules,
          ...(settings.anomalyRules || {}),
        },
      };

      persistAISettings(mergedSettings);
      return { aiSettings: mergedSettings };
    }),

    resetAISettings: () => set(() => {
      persistAISettings(DEFAULT_AI_SETTINGS);
      return { aiSettings: DEFAULT_AI_SETTINGS };
    }),

    upsertDevice: (update) => set((state) => {
      const id = update.collar_id;
      const current = state.devices[id] || {};
      const updatedDevice = { ...current, ...update } as IAnimal;

      // Update history if critical features changed (lat, lng, speed, temp)
      let newHistory = state.history;
      if (update.lat !== undefined || update.lng !== undefined || update.speed !== undefined || update.temperature !== undefined) {
        const currentHist = state.history[id] || [];
        // Store the full snapshot of the device at this point in time
        const updatedHist = [...currentHist, { ...updatedDevice }].slice(-20);
        newHistory = { ...state.history, [id]: updatedHist };
      }

      const updatedDevices = { ...state.devices, [id]: updatedDevice };
      saveData('last_known_devices', updatedDevices);

      return {
        devices: updatedDevices,
        history: newHistory,
      };
    }),

    batchUpdateDevices: (updates) => set((state) => {
      const newDevices = { ...state.devices };
      const newHistory = { ...state.history };

      Object.entries(updates).forEach(([id, update]) => {
        const current = newDevices[id] || {};
        newDevices[id] = { ...current, ...update } as IAnimal;
        const updatedDevice = newDevices[id];

        if (update.lat !== undefined || update.lng !== undefined || update.speed !== undefined || update.temperature !== undefined) {
          const currentHist = newHistory[id] || [];
          newHistory[id] = [...currentHist, { ...updatedDevice }].slice(-120);
        }
      });

      saveData('last_known_devices', newDevices);
      return { devices: newDevices, history: newHistory };
    }),

    addAlert: (alert) => set((state) => {
      const alertPriority = (a: Alert) => {
        if (a.source === 'socket') return 3;
        if (a.source === 'mqtt') return 2;
        return 1;
      };

      const toTs = (a: Alert) => {
        const t = new Date(a.timestamp).getTime();
        return Number.isNaN(t) ? 0 : t;
      };

      const incomingKey = getAlertNaturalKey(alert);
      const existing = state.alerts.find((candidate) => getAlertNaturalKey(candidate) === incomingKey);
      const normalizedAlert = existing
        ? {
          ...existing,
          ...alert,
          read: existing.read || alert.read,
          readAt: existing.readAt ?? alert.readAt,
        }
        : alert;

      const merged = [normalizedAlert, ...state.alerts.filter(a => getAlertNaturalKey(a) !== incomingKey)]
        .sort((a, b) => {
          const byPriority = alertPriority(b) - alertPriority(a);
          if (byPriority !== 0) return byPriority;
          return toTs(b) - toTs(a);
        })
        .slice(0, 100);

      saveData('last_known_alerts', merged);
      return { alerts: merged };
    }),

    markAlertAsRead: (id) => set((state) => {
      const updatedAlerts = state.alerts.map((a) =>
        a.id === id ? { ...a, read: true, readAt: new Date().toISOString() } : a
      );

      saveData('last_known_alerts', updatedAlerts);
      return { alerts: updatedAlerts };
    }),

    markAllAlertsAsRead: () => set((state) => {
      const newAlerts = state.alerts.map((a) => ({
        ...a,
        read: true,
        readAt: new Date().toISOString(),
      }));
      saveData('last_known_alerts', newAlerts);
      return { alerts: newAlerts };
    }),
  }))
);

/**
 * High-performance helper to queue updates and flush them in batches
 * Prevents UI jitter and excessive re-renders during high-frequency IoT pings
 */
export const queueIoTUpdate = (collar_id: string, update: Partial<IAnimal>) => {
  updateBuffer[collar_id] = { ...(updateBuffer[collar_id] || {}), ...update };

  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      const currentUpdates = { ...updateBuffer };
      updateBuffer = {};
      batchTimeout = null;

      // Execute the batch update in the store
      useIoTStore.getState().batchUpdateDevices(currentUpdates);
    }, 300); // 300ms batch interval as requested
  }
};
