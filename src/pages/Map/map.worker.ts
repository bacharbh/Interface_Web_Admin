import * as tf from '@tensorflow/tfjs';
import { IAnimal, IGeofenceZone, IKpis } from '../../types';
import { prepareTimeSeriesData } from '../../utils/ml/featureEngineering';

// Constants for Anomaly Detection
const MODEL_PATH = 'indexeddb://smart-shepherd-anomaly-v2';
let cachedModel: tf.LayersModel | null = null;
const lastAlertTimes: Record<string, number> = {};
const consecutiveAlerts: Record<string, number> = {};
const lastScores: Record<string, number> = {};

/**
 * Initialize TF.js and load the model within the worker
 */
async function initML() {
  try {
    const models = await tf.io.listModels();
    if (models[MODEL_PATH]) {
      cachedModel = await tf.loadLayersModel(MODEL_PATH);
      console.log("✅ Worker: Model loaded from IndexedDB");
    } else {
      console.log("⚠️ Worker: No model found, building fresh v2 model...");
      const model = tf.sequential();
      model.add(tf.layers.lstm({ units: 32, inputShape: [120, 5], returnSequences: false }));
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'binaryCrossentropy' });

      // Warmup
      const dummyX = tf.zeros([1, 120, 5]);
      model.predict(dummyX);
      dummyX.dispose();

      cachedModel = model;
      await model.save(MODEL_PATH);
    }
  } catch (e) {
    console.error("❌ Worker ML Initialization failed:", e);
  }
}

/**
 * Perform geofence check (Point in Polygon)
 */
function isPointInPolygon(lat: number, lng: number, polygon: [number, number][]) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * Calculate distance in meters using Haversine formula
 */
function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;    // Math.PI / 180
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 +
    c(lat1 * p) * c(lat2 * p) *
    (1 - c((lon2 - lon1) * p)) / 2;

  return 12742 * Math.asin(Math.sqrt(a)) * 1000;
}

/**
 * Process a batch of animals
 */
async function processAnimals(
  animals: Record<string, IAnimal>,
  history: Record<string, IAnimal[]>,
  zones: IGeofenceZone[]
) {
  const enriched: IAnimal[] = [];
  const newAiAlerts: any[] = [];
  const kpis: IKpis = {
    totalActive: 0,
    safe: 0,
    outOfZone: 0,
    lowBattery: 0,
    critical: 0,
    avgBattery: 0,
    unreadAlerts: 0,
    criticalAlerts: 0
  };

  let totalBat = 0;
  const animalIds = Object.keys(animals);

  for (const id of animalIds) {
    const animal = { ...animals[id] };
    const battery = animal.battery ?? 0;
    const lat = typeof animal.lat === 'number' ? animal.lat : 0;
    const lng = typeof animal.lng === 'number' ? animal.lng : 0;
    kpis.totalActive++;
    totalBat += battery;

    // 1. Geofence Check
    let isOutOfZone = true;
    if (zones.length === 0) isOutOfZone = false;
    for (const zone of zones) {
      if (isPointInPolygon(lat, lng, zone.coords)) {
        isOutOfZone = false;
        break;
      }
    }

    // 2. Status Determination
    if (isOutOfZone) {
      animal.status = 'OUT_OF_ZONE';
      kpis.outOfZone++;
    } else if (battery < 15) {
      animal.status = 'CRITICAL';
      kpis.critical++;
    } else if (battery < 30) {
      animal.status = 'LOW_BATTERY';
      kpis.lowBattery++;
    } else {
      animal.status = 'SAFE';
      kpis.safe++;
    }

    // 3. ML Inference (Anomaly Detection)
    const animalHistory = history[id] || [];
    if (cachedModel && animalHistory.length >= 5) {
      try {
        const tensorData = prepareTimeSeriesData(animalHistory);
        if (tensorData) {
          const predictionValue = tf.tidy(() => {
            const inputTensor = tf.tensor3d([tensorData], [1, 120, 5]);
            const output = cachedModel!.predict(inputTensor) as tf.Tensor;
            return output.dataSync()[0];
          });

          // Calculate Momentum (vitesse de détérioration)
          const lastScore = lastScores[id] || predictionValue;
          const momentum = predictionValue - lastScore;
          lastScores[id] = predictionValue;

          // Store ML results in a dedicated field
          (animal as any).mlResult = {
            score: predictionValue,
            label: predictionValue >= 0.8 ? 'critical' : predictionValue >= 0.6 ? 'suspect' : 'normal',
            confidence: predictionValue > 0.5 ? predictionValue : 1 - predictionValue,
            momentum: momentum
          };

          // Override status if ML detects critical anomaly
          if ((animal as any).mlResult.label === 'critical' || momentum > 0.5) {
            if (animal.status === 'SAFE') {
              animal.status = 'CRITICAL';
              kpis.critical++;
              kpis.safe--;
            }

            // Generate an AI Alert with Adaptive Cooldown
            const now = Date.now();
            const consecutiveCount = consecutiveAlerts[id] || 0;
            const cooldown = consecutiveCount >= 3 ? 15000 : 60000;

            if (!lastAlertTimes[id] || (now - lastAlertTimes[id] > cooldown)) {
              lastAlertTimes[id] = now;
              consecutiveAlerts[id] = consecutiveCount + 1;

              newAiAlerts.push({
                id: Date.now() + Math.random(),
                type: 'health',
                animalId: animal.collar_id,
                animalName: animal.name,
                timestamp: new Date().toISOString(),
                riskScore: Math.round(predictionValue * 100),
                message: momentum > 0.5
                  ? 'DÉGRADATION RAPIDE : État de santé se détériore violemment'
                  : 'Comportement anormal détecté par IA (Panique / Hyperactivité)',
                isAdaptive: consecutiveCount >= 3
              });
            }
          } else {
            // Reset consecutive alerts if status is normal and momentum is low
            if (predictionValue < 0.4 && momentum < 0.1) {
              consecutiveAlerts[id] = 0;
            }
          }
        }
      } catch (e) {
        console.error(`Inference error for ${id}:`, e);
      }
    }

    enriched.push(animal);
  }

  if (kpis.totalActive > 0) {
    kpis.avgBattery = Math.round(totalBat / kpis.totalActive);
  }

  // --- High-Performance Spatial Clustering Algorithm (Grid-based O(N)) ---
  const CLUSTER_DISTANCE = 0.00045; // Approx 50 meters
  const grid: Record<string, IAnimal[]> = {};
  const clusters: any[] = [];
  const finalAnimals: IAnimal[] = [];

  // 1. Assign animals to grid cells
  enriched.forEach(animal => {
    if (typeof animal.lat !== 'number' || typeof animal.lng !== 'number') return;
    const gridX = Math.floor(animal.lat / CLUSTER_DISTANCE);
    const gridY = Math.floor(animal.lng / CLUSTER_DISTANCE);
    const key = `${gridX},${gridY}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(animal);
  });

  // 2. Process grid cells
  Object.entries(grid).forEach(([key, members]) => {
    if (members.length >= 5) {
      // Create a cluster from this cell
      let centerLat = 0;
      let centerLng = 0;
      const counts: Record<'SAFE' | 'LOW_BATTERY' | 'OUT_OF_ZONE' | 'CRITICAL', number> = {
        SAFE: 0,
        LOW_BATTERY: 0,
        OUT_OF_ZONE: 0,
        CRITICAL: 0,
      };

      members.forEach(m => {
        centerLat += m.lat;
        centerLng += m.lng;
        counts[m.status as keyof typeof counts] = (counts[m.status as keyof typeof counts] || 0) + 1;
      });

      // Determine dominant status for the cluster
      let dominantStatus: keyof typeof counts = 'SAFE';
      if (counts.CRITICAL > 0) dominantStatus = 'CRITICAL';
      else if (counts.OUT_OF_ZONE > 0) dominantStatus = 'OUT_OF_ZONE';
      else if (counts.LOW_BATTERY > 0) dominantStatus = 'LOW_BATTERY';

      clusters.push({
        id: `cluster-${key}`,
        lat: centerLat / members.length,
        lng: centerLng / members.length,
        count: members.length,
        status: dominantStatus,
      });
    } else {
      finalAnimals.push(...members);
    }
  });

  return { enriched, kpis, newAiAlerts, clusters, finalAnimals };
}

// Worker message handler
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    await initML();
    self.postMessage({ type: 'READY' });
  }

  if (type === 'PROCESS_BATCH') {
    const { animals, history, zones } = payload;
    const result = await processAnimals(animals, history, zones);
    self.postMessage({ type: 'BATCH_RESULT', payload: result });
  }
};
