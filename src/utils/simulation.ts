import { Alert, queueIoTUpdate, useIoTStore } from '../hooks/useIoTStore';
import { IAnimal as Animal } from '../types';
import { notificationService } from '../services/notificationService';

const BREEDS = ['Merinos', 'Ouessant', 'Suffolk', 'Rambouillet', 'Lacaune', 'Texel', 'Dorper', 'Jacob'];
const NAMES_PREFIX = ['Bélier', 'Brebis', 'Agneau', 'Mouton'];
const HEALTH_STATES: ('Good' | 'Warning' | 'Critical')[] = ['Good', 'Good', 'Good', 'Good', 'Good', 'Warning', 'Warning', 'Critical'];

let currentCenter = { lat: 33.885, lng: -5.54 };

export type SimulationSpeed = 'slow' | 'normal' | 'fast';
export type SpawnDensity = 'sparse' | 'medium' | 'dense';
export type GroupBehavior = 'compact' | 'natural' | 'random';
export type AlertGenerationRate = 'low' | 'medium' | 'high';
export type SimulationScenario = 'normal' | 'emergency' | 'lost_sheep' | 'battery_failure';

export interface SimulationSettings {
  animalCount: number;
  updateInterval: number;
  simulationSpeed: SimulationSpeed;
  spawnDensity: SpawnDensity;
  spawnRadius: number;
  groupBehavior: GroupBehavior;
  alertGenerationRate: AlertGenerationRate;
  batteryDrainEnabled: boolean;
  autoClusteringEnabled: boolean;
  scenario: SimulationScenario;
}

const DEFAULT_SIMULATION_SETTINGS: SimulationSettings = {
  animalCount: 200,
  updateInterval: 3000,
  simulationSpeed: 'normal',
  spawnDensity: 'medium',
  spawnRadius: 1,
  groupBehavior: 'natural',
  alertGenerationRate: 'medium',
  batteryDrainEnabled: true,
  autoClusteringEnabled: true,
  scenario: 'normal',
};

let simulationSettings: SimulationSettings = { ...DEFAULT_SIMULATION_SETTINGS };

export const setSimulationCenter = (lat: number, lng: number) => {
  currentCenter = { lat, lng };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const resolveSpawnSpread = () => {
  const densitySpread: Record<SpawnDensity, number> = {
    sparse: 0.024,
    medium: 0.016,
    dense: 0.009,
  };

  return densitySpread[simulationSettings.spawnDensity] * simulationSettings.spawnRadius;
};

const resolveMovementFactor = (behavior: 'GRAZING' | 'RESTING' | 'RUNNING' | 'PANICKING') => {
  const speedFactor: Record<SimulationSpeed, number> = {
    slow: 0.7,
    normal: 1,
    fast: 1.35,
  };

  const factor = behavior === 'RUNNING' ? 0.0012 : behavior === 'PANICKING' ? 0.0018 : behavior === 'RESTING' ? 0.00008 : 0.00045;
  return factor * speedFactor[simulationSettings.simulationSpeed];
};

const resolveAlertChance = () => {
  const rates: Record<AlertGenerationRate, number> = {
    low: 0.002,
    medium: 0.004,
    high: 0.01,
  };

  return rates[simulationSettings.alertGenerationRate];
};

const resolveGroupCount = (count: number) => {
  if (simulationSettings.groupBehavior === 'compact') return Math.max(3, Math.floor(count / 18));
  if (simulationSettings.groupBehavior === 'random') return Math.max(8, Math.floor(count / 10));
  return Math.max(5, Math.floor(count / 14));
};

export function generateMockAnimals(count = simulationSettings.animalCount): Animal[] {
  const animals: Animal[] = [];
  const centerLat = currentCenter.lat;
  const centerLng = currentCenter.lng;
  const spreadLat = resolveSpawnSpread();
  const spreadLng = spreadLat * 1.15;
  const groupCount = resolveGroupCount(count);
  const groupCenters = Array.from({ length: groupCount }, (_, index) => ({
    lat: centerLat + (Math.sin(index) * spreadLat * 0.7),
    lng: centerLng + (Math.cos(index) * spreadLng * 0.7),
  }));

  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, '0')}`;
    const prefix = NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)];
    const breed = BREEDS[Math.floor(Math.random() * BREEDS.length)];
    const health = HEALTH_STATES[Math.floor(Math.random() * HEALTH_STATES.length)];
    const groupIndex = i % groupCount;
    const group = groupCenters[groupIndex];
    const localSpread = simulationSettings.groupBehavior === 'compact' ? 0.0018 : simulationSettings.groupBehavior === 'random' ? 0.007 : 0.0035;
    const battery = health === 'Critical'
      ? Math.floor(Math.random() * 15) + 3
      : health === 'Warning'
        ? Math.floor(Math.random() * 30) + 15
        : Math.floor(Math.random() * 40) + 60;

    animals.push({
      collar_id: id,
      name: `${prefix} #${i}`,
      breed,
      lat: group.lat + (Math.random() - 0.5) * localSpread,
      lng: group.lng + (Math.random() - 0.5) * localSpread * 1.2,
      status: 'SAFE',
      battery,
      health,
      speed: +(Math.random() * 2).toFixed(1),
      heading: Math.floor(Math.random() * 360),
      temperature: +(37 + Math.random() * 3).toFixed(1),
      heartRate: 75,
      activity_level: 1,
      lastUpdate: new Date().toLocaleTimeString(),
      rssi: -Math.floor(Math.random() * 40 + 50)
    });
  }
  return animals;
}

let simInterval: NodeJS.Timeout | null = null;
let currentCount = DEFAULT_SIMULATION_SETTINGS.animalCount;
let currentInterval = DEFAULT_SIMULATION_SETTINGS.updateInterval;
let panicStates: Record<string, number> = {};
let lstmAnomalyStates: Record<string, { score: number; type: string; startTime: number }> = {};

export const updateSimulationConfig = (countOrSettings: number | Partial<SimulationSettings>, interval?: number) => {
  if (typeof countOrSettings === 'number') {
    currentCount = countOrSettings;
    if (typeof interval === 'number') {
      currentInterval = interval;
    }
    simulationSettings = {
      ...simulationSettings,
      animalCount: currentCount,
      updateInterval: currentInterval,
    };
  } else {
    simulationSettings = {
      ...simulationSettings,
      ...countOrSettings,
      animalCount: countOrSettings.animalCount ?? currentCount,
      updateInterval: countOrSettings.updateInterval ?? currentInterval,
    };

    currentCount = simulationSettings.animalCount;
    currentInterval = simulationSettings.updateInterval;
  }

  if (simInterval) {
    stopSimulation();
    startSimulation();
  }
};

export const pauseSimulation = () => stopSimulation();

export const resetSimulation = () => {
  stopSimulation();
  panicStates = {};
  lstmAnomalyStates = {};
  startSimulation();
};

export const applySimulationScenario = (scenario: SimulationScenario) => {
  simulationSettings = {
    ...simulationSettings,
    scenario,
    autoClusteringEnabled: scenario === 'normal' ? simulationSettings.autoClusteringEnabled : true,
    batteryDrainEnabled: scenario === 'battery_failure' ? true : simulationSettings.batteryDrainEnabled,
    spawnDensity: scenario === 'lost_sheep' ? 'sparse' : scenario === 'emergency' ? 'dense' : simulationSettings.spawnDensity,
    groupBehavior: scenario === 'lost_sheep' ? 'random' : scenario === 'emergency' ? 'compact' : simulationSettings.groupBehavior,
    alertGenerationRate: scenario === 'emergency' ? 'high' : scenario === 'battery_failure' ? 'high' : simulationSettings.alertGenerationRate,
  };

  if (simInterval) {
    stopSimulation();
    startSimulation();
  }
};

export const startSimulation = () => {
  if (simInterval) return;

  const mockAnimals = generateMockAnimals(currentCount);
  const store = useIoTStore.getState();

  // Initial state push
  const initialUpdates: Record<string, Partial<Animal>> = {};
  mockAnimals.forEach(a => {
    initialUpdates[a.collar_id] = { ...a };
  });
  store.batchUpdateDevices(initialUpdates);

  simInterval = setInterval(() => {
    const currentState = useIoTStore.getState().devices;
    const alertChance = resolveAlertChance();

    Object.keys(currentState).forEach(id => {
      const animal = currentState[id];

      // --- Behavioral States Simulation ---
      const hour = new Date().getHours();
      let behavior: 'GRAZING' | 'RESTING' | 'RUNNING' | 'PANICKING' = 'GRAZING';

      if (simulationSettings.scenario === 'emergency') {
        behavior = Math.random() > 0.4 ? 'RUNNING' : 'PANICKING';
      } else if (simulationSettings.scenario === 'lost_sheep') {
        behavior = Math.random() > 0.65 ? 'RUNNING' : 'GRAZING';
      } else if (simulationSettings.scenario === 'battery_failure') {
        behavior = hour < 6 || hour > 20 ? 'RESTING' : 'GRAZING';
      }

      // Night: mostly resting
      if (behavior === 'GRAZING' && (hour < 6 || hour > 20)) {
        behavior = Math.random() > 0.1 ? 'RESTING' : 'GRAZING';
      } else {
        // Day: mostly grazing, some running
        if (behavior === 'GRAZING') {
          behavior = Math.random() > 0.8 ? 'RUNNING' : 'GRAZING';
        }
      }

      // Inject Panic (Anomaly) for specific IDs
      if (id.endsWith('7') || id.endsWith('3')) {
        // 2% chance to start a panic that lasts 10 intervals
        if (!panicStates[id] && Math.random() < 0.02) {
          panicStates[id] = 10;
        }
      }

      if (panicStates[id] > 0) {
        behavior = 'PANICKING';
        panicStates[id]--;
      }

      // --- LSTM Anomaly Detection Simulation ---
      // Randomly inject anomalies (1% chance per interval)
      // Animals ending in 5, 7, 3 have higher chance of anomalies
      const idNumber = parseInt(id.replace('C', ''));
      const anomalyProbability = [3, 5, 7].includes(idNumber % 10) ? 0.05 : 0.01;

      if (!lstmAnomalyStates[id] && Math.random() < anomalyProbability) {
        const anomalyTypes = ['ARRHYTHMIA', 'FEVER', 'LETHARGY', 'ABNORMAL_MOVEMENT', 'STRESS'];
        const selectedType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
        // Score between 76-95 for anomaly state
        const score = 76 + Math.floor(Math.random() * 20);
        lstmAnomalyStates[id] = {
          score,
          type: selectedType,
          startTime: Date.now()
        };
      }

      // Decay anomaly score over time (duration ~20-30 seconds)
      if (lstmAnomalyStates[id]) {
        const duration = 20000 + Math.random() * 10000;
        const elapsed = Date.now() - lstmAnomalyStates[id].startTime;
        if (elapsed > duration) {
          delete lstmAnomalyStates[id];
        } else {
          // Gradually decrease score as anomaly fades
          const decayFactor = 1 - (elapsed / duration) * 0.3;
          lstmAnomalyStates[id].score = Math.max(20, lstmAnomalyStates[id].score * decayFactor);
        }
      }

      // --- Behavior Impact on Telemetry ---
      const moveFactor = resolveMovementFactor(behavior);
      const activityLevel = behavior === 'PANICKING' ? 4 : behavior === 'RUNNING' ? 3 : behavior === 'GRAZING' ? 1 : 0;
      const hrBase = behavior === 'PANICKING' ? 120 : behavior === 'RUNNING' ? 100 : 75;
      const tempBase = behavior === 'PANICKING' ? 40.2 : 38.5;

      const heading = (animal.heading ?? 0) * (Math.PI / 180);
      const drift = simulationSettings.groupBehavior === 'compact' ? 0.25 : simulationSettings.groupBehavior === 'random' ? 1 : 0.55;
      const groupDrift = simulationSettings.scenario === 'lost_sheep' ? 1.35 : simulationSettings.scenario === 'emergency' ? 1.2 : 1;
      const newLat = animal.lat + Math.cos(heading) * moveFactor * groupDrift + (Math.random() - 0.5) * moveFactor * drift;
      const newLng = animal.lng + Math.sin(heading) * moveFactor * groupDrift + (Math.random() - 0.5) * moveFactor * drift;

      // Update via batched queue for performance
      queueIoTUpdate(id, {
        lat: newLat,
        lng: newLng,
        speed: behavior === 'RUNNING' || behavior === 'PANICKING' ? +(Math.random() * 8 + 4).toFixed(1) : +(Math.random() * 2).toFixed(1),
        heading: Math.floor(Math.random() * 360),
        battery: simulationSettings.batteryDrainEnabled && Math.random() < (simulationSettings.scenario === 'battery_failure' ? 0.08 : 0.02)
          ? Math.max(1, animal.battery - (simulationSettings.scenario === 'battery_failure' ? 2 : 1))
          : animal.battery,
        temperature: +(tempBase + (Math.random() - 0.5) * 0.5).toFixed(1),
        heartRate: Math.floor(hrBase + (Math.random() - 0.5) * 10),
        activity_level: activityLevel,
        lastUpdate: new Date().toLocaleTimeString(),
        lstm_score: lstmAnomalyStates[id]?.score || 0,
        lstm_anomaly_type: lstmAnomalyStates[id]?.type || null,
      });

      // Random alerts
      if (Math.random() < alertChance) {
        const alertTypes = ['OUT_OF_ZONE', 'LOW_BATTERY', 'HEALTH_WARNING', 'COLLAR_OFFLINE'];
        const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const severity = simulationSettings.scenario === 'emergency' || simulationSettings.scenario === 'battery_failure'
          ? (Math.random() > 0.35 ? 'CRITICAL' : 'WARNING')
          : Math.random() > 0.6 ? 'CRITICAL' : 'WARNING';

        const newAlert: Alert = {
          id: Date.now() + Math.random(),
          type,
          collar_id: id,
          animal_name: animal.name,
          severity: severity as 'CRITICAL' | 'WARNING',
          timestamp: new Date().toISOString(),
          read: false,
          source: 'simulation',
        };

        store.addAlert(newAlert);
        notificationService.playNotification(severity === 'CRITICAL' ? 'critical' : 'default');
      }
    });
  }, currentInterval);
};

export const stopSimulation = () => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
};

export const getSimulationSettings = () => ({ ...simulationSettings });
