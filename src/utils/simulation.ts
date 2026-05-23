import { Alert, queueIoTUpdate, useIoTStore } from '../hooks/useIoTStore';
import { IAnimal as Animal } from '../types';
import { notificationService } from '../services/notificationService';

const BREEDS = ['Merinos', 'Ouessant', 'Suffolk', 'Rambouillet', 'Lacaune', 'Texel', 'Dorper', 'Jacob'];
const NAMES_PREFIX = ['Bélier', 'Brebis', 'Agneau', 'Mouton'];
const HEALTH_STATES: ('Good' | 'Warning' | 'Critical')[] = ['Good', 'Good', 'Good', 'Good', 'Good', 'Warning', 'Warning', 'Critical'];

let currentCenter = { lat: 33.885, lng: -5.54 };

export const setSimulationCenter = (lat: number, lng: number) => {
  currentCenter = { lat, lng };
};

export function generateMockAnimals(count = 200): Animal[] {
  const animals: Animal[] = [];
  const centerLat = currentCenter.lat;
  const centerLng = currentCenter.lng;
  const spreadLat = 0.012;
  const spreadLng = 0.015;

  for (let i = 1; i <= count; i++) {
    const id = `C${String(i).padStart(3, '0')}`;
    const prefix = NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)];
    const breed = BREEDS[Math.floor(Math.random() * BREEDS.length)];
    const health = HEALTH_STATES[Math.floor(Math.random() * HEALTH_STATES.length)];
    const battery = health === 'Critical'
      ? Math.floor(Math.random() * 15) + 3
      : health === 'Warning'
        ? Math.floor(Math.random() * 30) + 15
        : Math.floor(Math.random() * 40) + 60;

    animals.push({
      collar_id: id,
      name: `${prefix} #${i}`,
      breed,
      lat: centerLat + (Math.random() - 0.5) * spreadLat,
      lng: centerLng + (Math.random() - 0.5) * spreadLng,
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
let currentCount = 200;
let currentInterval = 3000;
let panicStates: Record<string, number> = {};
let lstmAnomalyStates: Record<string, { score: number; type: string; startTime: number }> = {};

export const updateSimulationConfig = (count: number, interval: number) => {
  currentCount = count;
  currentInterval = interval;

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

    Object.keys(currentState).forEach(id => {
      const animal = currentState[id];

      // --- Behavioral States Simulation ---
      const hour = new Date().getHours();
      let behavior: 'GRAZING' | 'RESTING' | 'RUNNING' | 'PANICKING' = 'GRAZING';

      // Night: mostly resting
      if (hour < 6 || hour > 20) {
        behavior = Math.random() > 0.1 ? 'RESTING' : 'GRAZING';
      } else {
        // Day: mostly grazing, some running
        behavior = Math.random() > 0.8 ? 'RUNNING' : 'GRAZING';
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
      const moveFactor = behavior === 'RUNNING' ? 0.0012 : behavior === 'PANICKING' ? 0.0018 : behavior === 'RESTING' ? 0.0001 : 0.0005;
      const activityLevel = behavior === 'PANICKING' ? 4 : behavior === 'RUNNING' ? 3 : behavior === 'GRAZING' ? 1 : 0;
      const hrBase = behavior === 'PANICKING' ? 120 : behavior === 'RUNNING' ? 100 : 75;
      const tempBase = behavior === 'PANICKING' ? 40.2 : 38.5;

      const newLat = animal.lat + (Math.random() - 0.5) * moveFactor;
      const newLng = animal.lng + (Math.random() - 0.5) * moveFactor;

      // Update via batched queue for performance
      queueIoTUpdate(id, {
        lat: newLat,
        lng: newLng,
        speed: behavior === 'RUNNING' || behavior === 'PANICKING' ? +(Math.random() * 8 + 4).toFixed(1) : +(Math.random() * 2).toFixed(1),
        heading: Math.floor(Math.random() * 360),
        battery: Math.random() < 0.02 ? Math.max(1, animal.battery - 1) : animal.battery,
        temperature: +(tempBase + (Math.random() - 0.5) * 0.5).toFixed(1),
        heartRate: Math.floor(hrBase + (Math.random() - 0.5) * 10),
        activity_level: activityLevel,
        lastUpdate: new Date().toLocaleTimeString(),
        lstm_score: lstmAnomalyStates[id]?.score || 0,
        lstm_anomaly_type: lstmAnomalyStates[id]?.type || null,
      });

      // Random alerts
      if (Math.random() < 0.004) {
        const alertTypes = ['OUT_OF_ZONE', 'LOW_BATTERY', 'HEALTH_WARNING', 'COLLAR_OFFLINE'];
        const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        const severity = Math.random() > 0.6 ? 'CRITICAL' : 'WARNING';

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
