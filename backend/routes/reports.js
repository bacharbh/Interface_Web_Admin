/**
 * Smart Shepherd - Reports API Routes
 * Routes pour la génération de rapports PDF et export de données
 */

import express from 'express';
import reportGenerator from '../services/reportGenerator.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

/**
 * POST /api/reports/weekly
 * Générer un rapport hebdomadaire en PDF
 */
router.post('/weekly',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    body('startDate').isISO8601().withMessage('Date de début invalide'),
    body('endDate').isISO8601().withMessage('Date de fin invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { startDate, endDate } = req.body;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const pdfBuffer = await reportGenerator.generateWeeklyReport(start, end);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="smart-shepherd-weekly-${startDate}-${endDate}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur génération rapport hebdomadaire:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération du rapport hebdomadaire'
      });
    }
  }
);

/**
 * POST /api/reports/monthly
 * Générer un rapport mensuel en PDF
 */
router.post('/monthly',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    body('year').isInt({ min: 2020, max: 2030 }).withMessage('Année invalide'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Mois invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { year, month } = req.body;
      const pdfBuffer = await reportGenerator.generateMonthlyReport(year, month);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="smart-shepherd-monthly-${year}-${month}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur génération rapport mensuel:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération du rapport mensuel'
      });
    }
  }
);

/**
 * POST /api/reports/veterinary/:sheepId
 * Générer un rapport vétérinaire par animal
 */
router.post('/veterinary/:sheepId',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    body('startDate').isISO8601().withMessage('Date de début invalide'),
    body('endDate').isISO8601().withMessage('Date de fin invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { sheepId } = req.params;
      const { startDate, endDate } = req.body;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const pdfBuffer = await reportGenerator.generateVeterinaryReport(sheepId, start, end);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="veterinary-report-${sheepId}-${startDate}-${endDate}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur génération rapport vétérinaire:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération du rapport vétérinaire'
      });
    }
  }
);

/**
 * GET /api/reports/export/health-data
 * Exporter les données de santé en format pour Excel
 */
router.get('/export/health-data',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    query('startDate').isISO8601().withMessage('Date de début invalide'),
    query('endDate').isISO8601().withMessage('Date de fin invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { startDate, endDate, sheepId } = req.query;
      const TelemetryData = (await import('../models/TelemetryData.js')).default;

      const query = {
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (sheepId) {
        query.sheepId = sheepId;
      }

      const healthData = await TelemetryData.find(query)
        .sort({ timestamp: 1 })
        .lean();

      // Transformer les données pour l'export Excel
      const exportData = healthData.map(d => ({
        'ID Animal': d.sheepId,
        'ID Appareil': d.deviceId,
        'Date/Heure': d.timestamp,
        'Fréquence Cardiaque (BPM)': d.heartRate,
        'Température (°C)': d.temperature,
        'Batterie (%)': d.battery,
        'Activité': d.activity,
        'Signal (dBm)': d.signalStrength,
        'Pas': d.steps,
        'Vitesse (km/h)': d.speed,
        'Cap (°)': d.heading,
        'Latitude': d.location?.lat,
        'Longitude': d.location?.lng
      }));

      res.json({
        success: true,
        data: exportData,
        count: exportData.length
      });
    } catch (error) {
      console.error('Erreur export données santé:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'export des données de santé'
      });
    }
  }
);

/**
 * GET /api/reports/export/analytics-data
 * Exporter les données pour analytics (positions GPS, activité, etc.)
 */
router.get('/export/analytics-data',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    query('startDate').isISO8601().withMessage('Date de début invalide'),
    query('endDate').isISO8601().withMessage('Date de fin invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { startDate, endDate } = req.query;
      const TelemetryData = (await import('../models/TelemetryData.js')).default;

      const analyticsData = await TelemetryData.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              sheepId: '$sheepId',
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
            },
            avgHeartRate: { $avg: '$heartRate' },
            avgTemperature: { $avg: '$temperature' },
            avgBattery: { $avg: '$battery' },
            totalSteps: { $sum: '$steps' },
            avgSpeed: { $avg: '$speed' },
            activities: { $push: '$activity' },
            positions: { $push: '$location' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ]);

      res.json({
        success: true,
        data: analyticsData,
        count: analyticsData.length
      });
    } catch (error) {
      console.error('Erreur export données analytics:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'export des données analytics'
      });
    }
  }
);

/**
 * GET /api/reports/summary
 * Obtenir un résumé pour la période spécifiée
 */
router.get('/summary',
  authenticate,
  requireRole('admin', 'viewer'),
  [
    query('startDate').isISO8601().withMessage('Date de début invalide'),
    query('endDate').isISO8601().withMessage('Date de fin invalide')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { startDate, endDate } = req.query;
      const TelemetryData = (await import('../models/TelemetryData.js')).default;
      const Sheep = (await import('../models/Sheep.js')).default;

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Statistiques générales
      const totalSheep = await Sheep.countDocuments({ isActive: true });
      const totalRecords = await TelemetryData.countDocuments({
        timestamp: { $gte: start, $lte: end }
      });

      // Statistiques de santé
      const healthStats = await TelemetryData.aggregate([
        {
          $match: {
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: null,
            avgHeartRate: { $avg: '$heartRate' },
            avgTemperature: { $avg: '$temperature' },
            avgBattery: { $avg: '$battery' },
            minHeartRate: { $min: '$heartRate' },
            maxHeartRate: { $max: '$heartRate' },
            minTemperature: { $min: '$temperature' },
            maxTemperature: { $max: '$temperature' }
          }
        }
      ]);

      // Distribution des activités
      const activityDistribution = await TelemetryData.aggregate([
        {
          $match: {
            timestamp: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: '$activity',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Alertes
      const alerts = {
        highHeartRate: await TelemetryData.countDocuments({
          timestamp: { $gte: start, $lte: end },
          heartRate: { $gt: 120 }
        }),
        lowHeartRate: await TelemetryData.countDocuments({
          timestamp: { $gte: start, $lte: end },
          heartRate: { $lt: 60 }
        }),
        highTemperature: await TelemetryData.countDocuments({
          timestamp: { $gte: start, $lte: end },
          temperature: { $gt: 40.5 }
        }),
        lowTemperature: await TelemetryData.countDocuments({
          timestamp: { $gte: start, $lte: end },
          temperature: { $lt: 38.0 }
        }),
        lowBattery: await TelemetryData.countDocuments({
          timestamp: { $gte: start, $lte: end },
          battery: { $lt: 20 }
        })
      };

      res.json({
        success: true,
        data: {
          period: { startDate, endDate },
          summary: {
            totalSheep,
            totalRecords
          },
          health: healthStats[0] || {},
          activityDistribution,
          alerts
        }
      });
    } catch (error) {
      console.error('Erreur résumé rapports:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du résumé'
      });
    }
  }
);

export default router;
