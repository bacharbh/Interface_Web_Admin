/**
 * Smart Shepherd - AI Prediction Routes
 * Endpoints pour les prédictions de santé IA
 */

import express from 'express';
import aiService from '../services/aiHealthPrediction.js';
import { authenticate, authorize } from '../middleware/auth.js';
import AppError from '../utils/AppError.js';

const router = express.Router();

const safeInit = async () => {
  if (!aiService.isInitialized) {
    try { await aiService.initialize(); } catch (_) {}
  }
};

const buildSummary = (predictions) => {
  const summary = {
    totalAnimals: predictions.length,
    riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
    averageRiskScore: 0,
    animalsWithAnomalies: 0,
    highRiskAnimals: [],
    timestamp: new Date().toISOString()
  };
  let totalRisk = 0;
  predictions.forEach(pred => {
    const level = pred.riskScore?.level || 'unknown';
    if (summary.riskDistribution[level] !== undefined) summary.riskDistribution[level]++;
    totalRisk += pred.riskScore?.overallScore || 0;
    const anomalies = Array.isArray(pred.anomalies) ? pred.anomalies : (pred.anomalies?.anomalies || []);
    if (anomalies.length > 0) summary.animalsWithAnomalies++;
    if ((pred.riskScore?.overallScore || 0) > 70) {
      summary.highRiskAnimals.push({ sheepId: pred.sheepId, name: pred.name, riskScore: pred.riskScore?.overallScore, level });
    }
  });
  summary.averageRiskScore = predictions.length > 0 ? Math.round(totalRisk / predictions.length) : 0;
  return summary;
};

/**
 * GET /api/ai/predictions/:sheepId
 */
router.get('/predictions/:sheepId', authenticate, async (req, res) => {
  try {
    const { sheepId } = req.params;
    await safeInit();
    const [anomalyResult, healthPrediction] = await Promise.all([
      aiService.detectAnomalies(sheepId),
      aiService.predictHealth7Days(sheepId),
    ]);
    const anomalies = Array.isArray(anomalyResult?.anomalies) ? anomalyResult.anomalies : [];
    const riskScore = aiService._calcScoreFromAnomalies(anomalies);
    res.json({ success: true, data: { sheepId, anomalies, healthPrediction, riskScore, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/anomalies/:sheepId
 */
router.get('/anomalies/:sheepId', authenticate, async (req, res) => {
  try {
    const { sheepId } = req.params;
    const { timeWindow = '24h' } = req.query;
    await safeInit();
    const result = await aiService.detectAnomalies(sheepId, timeWindow);
    res.json({ success: true, data: { sheepId, timeWindow, ...result, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/prediction-7days/:sheepId
 */
router.get('/prediction-7days/:sheepId', authenticate, async (req, res) => {
  try {
    const { sheepId } = req.params;
    await safeInit();
    const prediction = await aiService.predictHealth7Days(sheepId);
    res.json({ success: true, data: { sheepId, ...prediction, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/risk-score/:sheepId
 */
router.get('/risk-score/:sheepId', authenticate, async (req, res) => {
  try {
    const { sheepId } = req.params;
    await safeInit();
    const anomalyResult = await aiService.detectAnomalies(sheepId);
    const anomalies = Array.isArray(anomalyResult?.anomalies) ? anomalyResult.anomalies : [];
    const riskScore = aiService._calcScoreFromAnomalies(anomalies);
    res.json({ success: true, data: { sheepId, riskScore, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/all-predictions
 */
router.get('/all-predictions', authenticate, async (req, res) => {
  try {
    await safeInit();
    const predictions = await aiService.getAllPredictions();
    res.json({ success: true, data: { predictions, count: predictions.length, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ai/train-models
 */
router.post('/train-models', authenticate, async (req, res) => {
  try {
    await safeInit();
    await aiService.trainModels();
    res.json({ success: true, message: 'Modèles IA réentraînés avec succès', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/model-status
 */
router.get('/model-status', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        isInitialized: aiService.isInitialized,
        anomalyModel: !!aiService.anomalyModel,
        lstmModel: !!aiService.lstmModel,
        modelConfig: aiService.modelConfig,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/predictions — summary alias
 */
router.get('/predictions', authenticate, async (req, res) => {
  try {
    await safeInit();
    const predictions = await aiService.getAllPredictions();
    const summary = buildSummary(predictions);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/health-summary
 */
router.get('/health-summary', authenticate, async (req, res) => {
  try {
    await safeInit();
    const predictions = await aiService.getAllPredictions();
    const summary = buildSummary(predictions);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/trends/:sheepId
 */
router.get('/trends/:sheepId', authenticate, async (req, res) => {
  try {
    const { sheepId } = req.params;
    const { period = '7d' } = req.query;
    const trends = await aiService.calculateTrends(sheepId);
    res.json({ success: true, data: { sheepId, period, ...trends, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ai/initialize
 */
router.post('/initialize', authenticate, async (req, res) => {
  try {
    await aiService.initialize();
    res.json({ success: true, message: 'Modèles IA initialisés avec succès', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
