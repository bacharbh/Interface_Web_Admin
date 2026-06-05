/**
 * Smart Shepherd - AI Prediction Routes
 * Endpoints pour les prédictions de santé IA
 */

import express from 'express';
import aiService from '../services/aiHealthPrediction.js';
import { authenticate, authorize } from '../middleware/auth.js';
// import { catchAsync } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

// Temporary catchAsync wrapper
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const router = express.Router();

/**
 * GET /api/ai/predictions/:sheepId
 * Obtenir les prédictions complètes pour un animal
 */
router.get('/predictions/:sheepId', authenticate, catchAsync(async (req, res) => {
  const { sheepId } = req.params;

  // Vérifier que le service IA est initialisé
  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  // Obtenir toutes les prédictions
  const [anomalies, healthPrediction, riskScore] = await Promise.all([
    aiService.detectAnomalies(sheepId),
    aiService.predictHealth7Days(sheepId),
    aiService.calculateRiskScore(sheepId)
  ]);

  res.json({
    success: true,
    data: {
      sheepId,
      anomalies,
      healthPrediction,
      riskScore,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/ai/anomalies/:sheepId
 * Détecter les anomalies pour un animal
 */
router.get('/anomalies/:sheepId', authenticate, catchAsync(async (req, res) => {
  const { sheepId } = req.params;
  const { timeWindow = '24h' } = req.query;

  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const anomalies = await aiService.detectAnomalies(sheepId, timeWindow);

  res.json({
    success: true,
    data: {
      sheepId,
      timeWindow,
      ...anomalies,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/ai/prediction-7days/:sheepId
 * Prédire la santé à J+7
 */
router.get('/prediction-7days/:sheepId', authenticate, catchAsync(async (req, res) => {
  const { sheepId } = req.params;

  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const prediction = await aiService.predictHealth7Days(sheepId);

  res.json({
    success: true,
    data: {
      sheepId,
      ...prediction,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/ai/risk-score/:sheepId
 * Calculer le score de risque global
 */
router.get('/risk-score/:sheepId', authenticate, catchAsync(async (req, res) => {
  const { sheepId } = req.params;

  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const riskScore = await aiService.calculateRiskScore(sheepId);

  res.json({
    success: true,
    data: {
      sheepId,
      ...riskScore,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/ai/all-predictions
 * Obtenir les prédictions pour tous les animaux
 */
router.get('/all-predictions', authenticate, catchAsync(async (req, res) => {
  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const predictions = await aiService.getAllPredictions();

  res.json({
    success: true,
    data: {
      predictions,
      count: predictions.length,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/ai/train-models
 * Réentraîner les modèles IA
 */
router.post('/train-models', authenticate, authorize('system:write'), catchAsync(async (req, res) => {
  // Vérifier que l'utilisateur a les permissions admin
  if (req.user.role !== 'ADMIN') {
    throw AppError.forbidden('Permissions administratives requises');
  }

  await aiService.trainModels();

  res.json({
    success: true,
    message: 'Modèles IA réentraînés avec succès',
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /api/ai/model-status
 * Obtenir le statut des modèles IA
 */
router.get('/model-status', authenticate, catchAsync(async (req, res) => {
  const status = {
    isInitialized: aiService.isInitialized,
    anomalyModel: !!aiService.anomalyModel,
    lstmModel: !!aiService.lstmModel,
    modelConfig: aiService.modelConfig,
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    data: status
  });
}));

/**
 * GET /api/ai/predictions
 * Résumé de prédictions IA global (alias de health-summary)
 */
router.get('/predictions', authenticate, catchAsync(async (req, res) => {
  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const predictions = await aiService.getAllPredictions();

  // Calculer les statistiques globales
  const summary = {
    totalAnimals: predictions.length,
    riskDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    averageRiskScore: 0,
    animalsWithAnomalies: 0,
    highRiskAnimals: [],
    timestamp: new Date().toISOString()
  };

  let totalRisk = 0;

  predictions.forEach(pred => {
    // Distribution des risques
    const level = pred.riskScore.level || 'unknown';
    if (summary.riskDistribution[level] !== undefined) {
      summary.riskDistribution[level]++;
    }

    // Score moyen
    totalRisk += pred.riskScore.overallScore || 0;

    // Animaux avec anomalies
    if (pred.anomalies.anomalies && pred.anomalies.anomalies.length > 0) {
      summary.animalsWithAnomalies++;
    }

    // Animaux à haut risque
    if (pred.riskScore.overallScore > 70) {
      summary.highRiskAnimals.push({
        sheepId: pred.sheepId,
        name: pred.name,
        riskScore: pred.riskScore.overallScore,
        level: pred.riskScore.level
      });
    }
  });

  summary.averageRiskScore = predictions.length > 0 ? Math.round(totalRisk / predictions.length) : 0;

  res.json({
    success: true,
    data: summary
  });
}));

/**
 * GET /api/ai/health-summary
 * Résumé de santé IA global (alias de /predictions)
 */
router.get('/health-summary', authenticate, catchAsync(async (req, res) => {
  if (!aiService.isInitialized) {
    await aiService.initialize();
  }

  const predictions = await aiService.getAllPredictions();

  // Calculer les statistiques globales
  const summary = {
    totalAnimals: predictions.length,
    riskDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    averageRiskScore: 0,
    animalsWithAnomalies: 0,
    highRiskAnimals: [],
    timestamp: new Date().toISOString()
  };

  let totalRisk = 0;

  predictions.forEach(pred => {
    // Distribution des risques
    const level = pred.riskScore.level || 'unknown';
    if (summary.riskDistribution[level] !== undefined) {
      summary.riskDistribution[level]++;
    }

    // Score moyen
    totalRisk += pred.riskScore.overallScore || 0;

    // Animaux avec anomalies
    if (pred.anomalies.anomalies && pred.anomalies.anomalies.length > 0) {
      summary.animalsWithAnomalies++;
    }

    // Animaux à haut risque
    if (pred.riskScore.overallScore > 70) {
      summary.highRiskAnimals.push({
        sheepId: pred.sheepId,
        name: pred.name,
        riskScore: pred.riskScore.overallScore,
        level: pred.riskScore.level
      });
    }
  });

  summary.averageRiskScore = predictions.length > 0 ? Math.round(totalRisk / predictions.length) : 0;

  res.json({
    success: true,
    data: summary
  });
}));

/**
 * GET /api/ai/trends/:sheepId
 * Obtenir les tendances pour un animal
 */
router.get('/trends/:sheepId', authenticate, catchAsync(async (req, res) => {
  const { sheepId } = req.params;
  const { period = '7d' } = req.query;

  const trends = await aiService.calculateTrends(sheepId);

  res.json({
    success: true,
    data: {
      sheepId,
      period,
      ...trends,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/ai/initialize
 * Initialiser les modèles IA
 */
router.post('/initialize', authenticate, authorize('system:write'), catchAsync(async (req, res) => {
  await aiService.initialize();

  res.json({
    success: true,
    message: 'Modèles IA initialisés avec succès',
    timestamp: new Date().toISOString()
  });
}));

export default router;
