/**
 * Smart Shepherd - AI Health Prediction Service
 * Module de prédiction de santé avec TensorFlow.js
 * Anomalie detection, LSTM prediction, scoring
 */

let tf = null;
let TF_AVAILABLE = true;
try {
  // Use pure-JS tfjs (compatible with all Node versions including Node 25+)
  const mod = await import('@tensorflow/tfjs').catch(() => null);
  if (!mod) {
    TF_AVAILABLE = false;
    console.warn('[AI] @tensorflow/tfjs not installed — AI features disabled');
  } else {
    tf = mod.default || mod;
    await tf.setBackend('cpu');
    await tf.ready();
    console.log('[AI] TensorFlow.js loaded (CPU backend, version', tf.version_core || tf.version?.tfjs, ')');
  }
} catch (err) {
  TF_AVAILABLE = false;
  console.warn('[AI] Error loading TensorFlow.js — AI features disabled:', err.message);
}

import axios from 'axios';
import { getAllAnimals, getAllHistory } from './firebaseService.js';
import { logger } from '../utils/errorLogger.js';

class AIHealthPredictionService {
  constructor() {
    this.anomalyModel = null;
    this.lstmModel = null;
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000/ai';
    this.isInitialized = false;
    this.modelConfig = {
      anomaly: {
        contamination: 0.1,
        nEstimators: 100,
        maxSamples: 'auto'
      },
      lstm: {
        sequenceLength: 120,
        batchSize: 32,
        epochs: 50,
        learningRate: 0.001
      }
    };
  }

  /**
   * Initialisation des modèles IA
   */
  async initialize() {
    try {
      logger.info('Initialisation des modèles IA de santé...');

      // Charger ou créer les modèles
      await this.loadOrCreateModels();

      this.isInitialized = true;
      logger.info('Modèles IA initialisés avec succès');

    } catch (error) {
      logger.error('Erreur lors de l\'initialisation IA:', error);
      throw error;
    }
  }

  /**
   * Charger ou créer les modèles
   */
  async loadOrCreateModels() {
    try {
      // Essayer de charger les modèles existants
      this.anomalyModel = await this.loadAnomalyModel();
      this.lstmModel = await this.loadLSTMModel();

      if (!this.anomalyModel || !this.lstmModel) {
        logger.info('Création des modèles IA...');
        await this.trainModels();
      }

    } catch (error) {
      logger.warn('Impossible de charger les modèles, création en cours:', error);
      await this.trainModels();
    }
  }

  /**
   * Entraîner les modèles IA
   */
  async trainModels() {
    logger.info('Début de l\'entraînement des modèles...');

    // Récupérer les données historiques
    const trainingData = await this.getTrainingData();

    if (trainingData.length < 100) {
      logger.warn('Données insuffisantes pour l\'entraînement');
      return;
    }

    // Entraîner modèle d'anomalie
    this.anomalyModel = await this.trainAnomalyModel(trainingData);

    // Entraîner modèle LSTM
    this.lstmModel = await this.trainLSTMModel(trainingData);

    // Sauvegarder les modèles
    await this.saveModels();

    logger.info('Entraînement des modèles terminé');
  }

  /**
   * Obtenir les données d'entraînement
   */
  async getTrainingData() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const from = thirtyDaysAgo.toISOString();
    const telemetryData = await getAllHistory({ limit: 5000, from });
    return telemetryData;
  }

  /**
   * Predict next position using Kalman Filter (Proxied to Python Service)
   */
  async predictPosition(sheepId) {
    try {
      const { getAnimalByCollarId, getAnimalHistory } = await import('./firebaseService.js');
      const sheep = await getAnimalByCollarId(sheepId);
      if (!sheep) return null;

      const recentTelemetry = await getAnimalHistory(sheepId, { limit: 10 });

      if (recentTelemetry.length < 2) return null;

      const response = await axios.post(`${this.aiServiceUrl}/predict-position`, {
        lastKnownGps: [recentTelemetry[0].lat, recentTelemetry[0].lng],
        lastKnownTimestamp: recentTelemetry[0].timestamp,
        herdPositions: [] // Could be populated with other sheep nearby
      });

      return response.data;
    } catch (error) {
      logger.error('Position prediction failed:', error.message);
      return null;
    }
  }

  /**
   * Entraîner modèle d'anomalie (Isolation Forest)
   */
  async trainAnomalyModel(data) {
    logger.info('Entraînement du modèle d\'anomalie...');

    // Préparer les données
    const features = data.map(record => [
      record.temperature || 38.5,
      record.heartRate || 70,
      this.normalizeActivity(record.activity),
      record.battery || 100,
      record.signalStrength || -50
    ]);

    const featureTensor = tf.tensor2d(features);

    // Créer le modèle Isolation Forest simplifié
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [5], units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    // Compiler le modèle
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    // Entraîner avec auto-encoding
    await model.fit(featureTensor, featureTensor, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            logger.info(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
          }
        }
      }
    });

    featureTensor.dispose();
    return model;
  }

  /**
   * Entraîner modèle LSTM pour prédiction
   */
  async trainLSTMModel(data) {
    logger.info('Entraînement du modèle LSTM...');

    // Grouper les données par animal
    const animalData = this.groupDataByAnimal(data);

    // Préparer les séquences
    const sequences = [];
    const targets = [];

    Object.values(animalData).forEach(animalRecords => {
      if (animalRecords.length >= this.modelConfig.lstm.sequenceLength) {
        const { seqs, targs } = this.createSequences(animalRecords);
        sequences.push(...seqs);
        targets.push(...targs);
      }
    });

    if (sequences.length < 10) {
      logger.warn('Séquences insuffisantes pour LSTM');
      return null;
    }

    // Créer les tensors
    const sequenceTensor = tf.tensor3d(sequences);
    const targetTensor = tf.tensor2d(targets);

    // Créer le modèle LSTM
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [this.modelConfig.lstm.sequenceLength, 5]
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({ units: 32, returnSequences: false }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'linear' })
      ]
    });

    // Compiler le modèle
    model.compile({
      optimizer: tf.train.adam(this.modelConfig.lstm.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    // Entraîner
    await model.fit(sequenceTensor, targetTensor, {
      epochs: this.modelConfig.lstm.epochs,
      batchSize: this.modelConfig.lstm.batchSize,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            logger.info(`LSTM Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`);
          }
        }
      }
    });

    sequenceTensor.dispose();
    targetTensor.dispose();
    return model;
  }

  /**
   * Détecter les anomalies pour un animal
   */
  async detectAnomalies(sheepId, timeWindow = '24h') {
    if (!this.anomalyModel) {
      return { anomalies: [], riskScore: 0 };
    }

    const telemetryData = await this.getRecentTelemetry(sheepId, timeWindow);

    if (telemetryData.length === 0) {
      return { anomalies: [], riskScore: 0 };
    }

    // Préparer les features
    const features = telemetryData.map(record => [
      record.heartRate || 70,
      record.temperature || 38.5,
      record.battery || 100,
      record.signalStrength || -50,
      this.normalizeActivity(record.activity)
    ]);

    const featureTensor = tf.tensor2d(features);

    // Prédire les anomalies
    const predictions = this.anomalyModel.predict(featureTensor);
    const anomalyScores = await predictions.data();

    // Identifier les anomalies
    const anomalies = [];
    telemetryData.forEach((record, index) => {
      const anomalyScore = anomalyScores[index];
      if (anomalyScore > 0.7) { // Seuil d'anomalie
        anomalies.push({
          timestamp: record.timestamp,
          type: this.detectAnomalyType(record),
          severity: anomalyScore > 0.9 ? 'high' : 'medium',
          score: anomalyScore,
          values: {
            heartRate: record.heartRate,
            temperature: record.temperature,
            battery: record.battery,
            activity: record.activity
          }
        });
      }
    });

    featureTensor.dispose();
    predictions.dispose();

    // Calculer le score de risque
    const riskScore = this._calcScoreFromAnomalies(anomalies);

    return {
      anomalies,
      riskScore,
      analyzedRecords: telemetryData.length
    };
  }

  /**
   * Prédire la santé à J+7
   */
  async predictHealth7Days(sheepId) {
    if (!this.lstmModel) {
      throw new Error('Modèle LSTM non initialisé');
    }

    // Obtenir les 30 derniers jours de données
    const recentData = await this.getRecentTelemetry(sheepId, '30d');

    if (recentData.length < this.modelConfig.lstm.sequenceLength) {
      return {
        prediction: null,
        confidence: 0,
        message: 'Données historiques insuffisantes'
      };
    }

    // Préparer la séquence
    const sequence = this.preparePredictionSequence(recentData);
    const sequenceTensor = tf.tensor3d([sequence]);

    // Prédire
    const prediction = this.lstmModel.predict(sequenceTensor);
    const predictionData = await prediction.data();

    // Interpréter les prédictions
    const healthPrediction = this.interpretLSTMPrediction(predictionData);

    sequenceTensor.dispose();
    prediction.dispose();

    return {
      prediction: healthPrediction,
      confidence: this.calculatePredictionConfidence(recentData),
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inputRecords: recentData.length
    };
  }

  /**
   * Calculer le score de risque global (0-100)
   */
  async calculateRiskScore(sheepId) {
    try {
      // Détecter les anomalies
      const anomalyResult = await this.detectAnomalies(sheepId, '24h');

      // Prédire la santé future
      const healthPrediction = await this.predictHealth7Days(sheepId);

      // Obtenir les tendances
      const trends = await this.calculateTrends(sheepId);

      // Combiner les facteurs
      let riskScore = 0;

      // Anomalies récentes (40% du score)
      riskScore += anomalyResult.riskScore * 0.4;

      // Prédiction santé (30% du score)
      if (healthPrediction.prediction) {
        riskScore += healthPrediction.prediction.riskScore * 0.3;
      }

      // Tendances (20% du score)
      riskScore += trends.riskScore * 0.2;

      // Facteurs de base (10% du score)
      riskScore += this.calculateBaseRisk(sheepId) * 0.1;

      // Normaliser entre 0-100
      riskScore = Math.max(0, Math.min(100, riskScore));

      return {
        overallScore: Math.round(riskScore),
        components: {
          anomalies: Math.round(anomalyResult.riskScore),
          prediction: healthPrediction.prediction ? Math.round(healthPrediction.prediction.riskScore) : 0,
          trends: Math.round(trends.riskScore),
          base: Math.round(this.calculateBaseRisk(sheepId))
        },
        level: this.getRiskLevel(riskScore),
        recommendations: this.getRecommendations(riskScore, anomalyResult, healthPrediction)
      };

    } catch (error) {
      logger.error(`Erreur calcul score de risque pour ${sheepId}:`, error);
      return {
        overallScore: 50,
        level: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Obtenir les prédictions pour tous les animaux
   * Uses LocalAIService rules when TF models are unavailable (normal state in dev).
   */
  async getAllPredictions() {
    const { default: LocalAIService } = await import('./localAIService.js');
    const sheep = await getAllAnimals();

<<<<<<< HEAD
    return sheep.map(animal => {
      const riskLevel = LocalAIService.calculateRiskLevel(animal);
      const levelOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
=======
    for (const animal of sheep) {
      try {
        const [anomalyResult, healthPrediction] = await Promise.all([
          this.detectAnomalies(animal.sheepId),
          this.predictHealth7Days(animal.sheepId),
        ]);
        const anomalies = Array.isArray(anomalyResult?.anomalies) ? anomalyResult.anomalies : [];
        const riskScore = this.calculateRiskScore(anomalies, {});
>>>>>>> 06d853e5c17655b3af6f1c56ad6cf748927d17ef

      // Build anomaly entries from real sensor values
      const anomalyList = [];
      const now = new Date().toISOString();
      const temp = animal.temperature;
      const bpm = animal.heartRate ?? animal.bpm;
      const battery = animal.battery;

      if (temp && temp > 10) {
        if (temp > 40.5) anomalyList.push({ timestamp: now, type: 'FEVER_HIGH',   severity: 'high',   score: 0.9, values: { temperature: temp } });
        else if (temp > 39.8) anomalyList.push({ timestamp: now, type: 'FEVER_MILD', severity: 'medium', score: 0.6, values: { temperature: temp } });
        else if (temp < 37.5) anomalyList.push({ timestamp: now, type: 'HYPOTHERMIA', severity: 'high',  score: 0.8, values: { temperature: temp } });
      }
      if (bpm && bpm > 0) {
        if (bpm > 100) anomalyList.push({ timestamp: now, type: 'TACHYCARDIA', severity: 'medium', score: 0.7, values: { heartRate: bpm } });
        else if (bpm < 50) anomalyList.push({ timestamp: now, type: 'BRADYCARDIA', severity: 'medium', score: 0.7, values: { heartRate: bpm } });
      }
      if (battery != null && battery > 0 && battery < 15) {
        anomalyList.push({ timestamp: now, type: 'LOW_BATTERY', severity: 'low', score: 0.5, values: { battery } });
      }

      const anomalyRiskScore = Math.min(100, anomalyList.reduce((s, a) =>
        s + (a.severity === 'high' ? 30 : a.severity === 'medium' ? 15 : 5), 0));

      const overallScore = levelOrder[riskLevel] != null
        ? [10, 35, 65, 90][levelOrder[riskLevel]]
        : 10;

      const activityLabel = ['idle', 'resting', 'grazing', 'walking', 'running'][
        Math.min(4, Math.max(0, Math.round(animal.activity ?? 1)))
      ];

      const recommendations = [];
      if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') recommendations.push('Examen vétérinaire recommandé');
      if (temp && temp > 39.8) recommendations.push('Vérifier température corporelle');
      if (bpm && (bpm > 100 || bpm < 50)) recommendations.push('Surveiller fréquence cardiaque');
      if (battery != null && battery < 15) recommendations.push('Recharger le collier');

      return {
        sheepId: animal.sheepId || animal.collar_id,
        collar_id: animal.collar_id,
        name: animal.name || animal.sheepId || animal.collar_id,
        breed: animal.breed || 'Unknown',
        age: animal.age || 0,
        anomalies: {
          anomalies: anomalyList,
          riskScore: anomalyRiskScore,
        },
        healthPrediction: {
          prediction: {
            predictedValues: {
              heartRate: bpm ?? 0,
              temperature: temp ?? 0,
              battery: battery ?? 0,
              signalStrength: animal.rssi ?? -60,
              activity: activityLabel,
            },
            riskScore: overallScore,
            issues: anomalyList.map(a => a.type),
            trend: riskLevel === 'CRITICAL' ? 'deteriorating' : riskLevel === 'HIGH' ? 'deteriorating' : 'stable',
          },
          confidence: (temp && temp > 10 && bpm && bpm > 0) ? 80 : 50,
        },
        riskScore: {
          overallScore,
          level: riskLevel.toLowerCase(),
          components: {
            anomalies: anomalyRiskScore,
            prediction: overallScore,
            trends: 0,
            base: 10,
          },
          recommendations,
        },
        lastUpdate: new Date(),
      };
    });
  }

  /**
   * Méthodes utilitaires
   */
  normalizeActivity(activity) {
    const activityMap = {
      'idle': 0,
      'resting': 1,
      'grazing': 2,
      'walking': 3,
      'running': 4
    };
    return activityMap[activity] || 1;
  }

  detectAnomalyType(record) {
    if (record.heartRate && (record.heartRate < 60 || record.heartRate > 120)) {
      return 'heart_rate';
    }
    if (record.temperature && (record.temperature < 38.0 || record.temperature > 40.5)) {
      return 'temperature';
    }
    if (record.battery && record.battery < 20) {
      return 'battery';
    }
    return 'general';
  }

  _calcScoreFromAnomalies(anomalies) {
    if (!Array.isArray(anomalies) || anomalies.length === 0) return 0;
    return Math.min(100, anomalies.reduce((s, a) => s + (a.severity === 'high' ? 30 : 15), 0));
  }

  getRiskLevel(score) {
    if (score < 20) return 'low';
    if (score < 50) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  getRecommendations(score, anomalies, prediction) {
    const recommendations = [];

    if (score > 70) {
      recommendations.push('Examen vétérinaire recommandé');
    }

    if (anomalies.anomalies.some(a => a.type === 'heart_rate')) {
      recommendations.push('Surveillance fréquence cardiaque');
    }

    if (anomalies.anomalies.some(a => a.type === 'temperature')) {
      recommendations.push('Vérifier température corporelle');
    }

    if (prediction.prediction && prediction.prediction.riskScore > 60) {
      recommendations.push('Planifier examen de santé préventif');
    }

    return recommendations;
  }

  /**
   * Sauvegarder les modèles
   */
  async saveModels() {
    try {
      if (this.anomalyModel) {
        await this.anomalyModel.save('file://./models/anomaly-model');
      }
      if (this.lstmModel) {
        await this.lstmModel.save('file://./models/lstm-model');
      }
      logger.info('Modèles sauvegardés');
    } catch (error) {
      logger.error('Erreur sauvegarde modèles:', error);
    }
  }

  /**
   * Charger les modèles
   */
  async loadAnomalyModel() {
    try {
      return await tf.loadLayersModel('file://./models/anomaly-model/model.json');
    } catch (error) {
      return null;
    }
  }

  async loadLSTMModel() {
    try {
      return await tf.loadLayersModel('file://./models/lstm-model/model.json');
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtenir les données récentes
   */
  async getRecentTelemetry(sheepId, timeWindow) {
    const timeMap = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const timeAgo = new Date(Date.now() - (timeMap[timeWindow] || timeMap['24h']));

    const { getAnimalHistory } = await import('./firebaseService.js');
    return await getAnimalHistory(sheepId, { limit: 1000, from: timeAgo.toISOString() });
  }

  /**
   * Grouper les données par animal
   */
  groupDataByAnimal(data) {
    const grouped = {};
    data.forEach(record => {
      if (!grouped[record.sheepId]) {
        grouped[record.sheepId] = [];
      }
      grouped[record.sheepId].push(record);
    });
    return grouped;
  }

  /**
   * Créer les séquences pour LSTM
   */
  createSequences(records) {
    const sequences = [];
    const targets = [];
    const seqLength = this.modelConfig.lstm.sequenceLength;

    for (let i = 0; i <= records.length - seqLength; i++) {
      const sequence = [];
      for (let j = 0; j < seqLength; j++) {
        const record = records[i + j];
        sequence.push([
          record.temperature || 38.5,
          record.heartRate || 70,
          this.normalizeActivity(record.activity),
          record.battery || 100,
          record.signalStrength || -50
        ]);
      }

      // La cible est le prochain point de données
      const nextRecord = records[i + seqLength];
      if (nextRecord) {
        sequences.push(sequence);
        targets.push([
          nextRecord.temperature || 38.5,
          nextRecord.heartRate || 70,
          this.normalizeActivity(nextRecord.activity),
          nextRecord.battery || 100,
          nextRecord.signalStrength || -50
        ]);
      }
    }

    return { seqs: sequences, targs: targets };
  }

  /**
   * Préparer la séquence de prédiction
   */
  preparePredictionSequence(records) {
    const seqLength = this.modelConfig.lstm.sequenceLength;
    const sequence = [];

    // Prendre les dernières entrées
    const recentRecords = records.slice(-seqLength);

    recentRecords.forEach(record => {
      sequence.push([
        record.temperature || 38.5,
        record.heartRate || 70,
        this.normalizeActivity(record.activity),
        record.battery || 100,
        record.signalStrength || -50
      ]);
    });

    return sequence;
  }

  /**
   * Interpréter la prédiction LSTM
   */
  interpretLSTMPrediction(predictionData) {
    const [temperature, heartRate, activity, battery, signalStrength] = predictionData;

    let riskScore = 0;
    const issues = [];

    // Analyser chaque prédiction
    if (heartRate < 60 || heartRate > 120) {
      riskScore += 30;
      issues.push('fréquence cardiaque anormale');
    }

    if (temperature < 38.0 || temperature > 40.5) {
      riskScore += 25;
      issues.push('température corporelle anormale');
    }

    if (battery < 20) {
      riskScore += 20;
      issues.push('batterie faible');
    }

    if (signalStrength < -80) {
      riskScore += 15;
      issues.push('signal faible');
    }

    return {
      predictedValues: {
        heartRate: Math.round(heartRate),
        temperature: parseFloat(temperature.toFixed(1)),
        battery: Math.round(battery),
        signalStrength: Math.round(signalStrength),
        activity: this.denormalizeActivity(activity)
      },
      riskScore: Math.min(100, riskScore),
      issues,
      trend: this.calculateTrend(predictionData)
    };
  }

  denormalizeActivity(activity) {
    const activities = ['idle', 'resting', 'grazing', 'walking', 'running'];
    const index = Math.round(activity);
    return activities[Math.max(0, Math.min(activities.length - 1, index))];
  }

  calculateTrend(predictionData) {
    // Simple logique de tendance basée sur les valeurs prédites
    const [heartRate, temperature] = predictionData;

    if (heartRate > 100 && temperature > 39.5) {
      return 'deteriorating';
    } else if (heartRate < 80 && temperature < 38.5) {
      return 'improving';
    }
    return 'stable';
  }

  calculatePredictionConfidence(data) {
    // Plus de données = plus de confiance
    const dataPoints = data.length;
    if (dataPoints > 100) return 0.9;
    if (dataPoints > 50) return 0.8;
    if (dataPoints > 30) return 0.7;
    return 0.5;
  }

  async calculateTrends(sheepId) {
    const recentData = await this.getRecentTelemetry(sheepId, '7d');

    if (recentData.length < 10) {
      return { riskScore: 50, trend: 'insufficient_data' };
    }

    // Calculer les tendances
    const heartRateTrend = this.calculateParameterTrend(recentData, 'heartRate');
    const temperatureTrend = this.calculateParameterTrend(recentData, 'temperature');
    const batteryTrend = this.calculateParameterTrend(recentData, 'battery');

    let riskScore = 50;

    if (heartRateTrend < -5 || heartRateTrend > 10) riskScore += 20;
    if (temperatureTrend > 0.5) riskScore += 15;
    if (batteryTrend < -5) riskScore += 10;

    return {
      riskScore: Math.min(100, riskScore),
      trends: {
        heartRate: heartRateTrend,
        temperature: temperatureTrend,
        battery: batteryTrend
      }
    };
  }

  calculateParameterTrend(data, parameter) {
    const values = data.map(d => d[parameter]).filter(v => v !== undefined);
    if (values.length < 5) return 0;

    // Simple régression linéaire
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  calculateBaseRisk(sheepId) {
    // Facteurs de risque de base (âge, race, historique)
    // Pour l'instant, retourne une valeur par défaut
    return 25;
  }
}

class AIHealthPredictionServiceStub {
  async initialize() {
    console.warn('[AI] initialize skipped (tfjs missing)');
  }

  async getAllPredictions() {
    return [];
  }

  async detectAnomalies() {
    return { anomalies: [], riskScore: 0 };
  }

  async predictHealth7Days() {
    return { prediction: null, confidence: 0, message: 'AI unavailable' };
  }

  async calculateRiskScore() {
    return { overallScore: 0, level: 'unknown', error: 'AI unavailable' };
  }
}

const _instance = TF_AVAILABLE ? new AIHealthPredictionService() : new AIHealthPredictionServiceStub();

export default _instance;
