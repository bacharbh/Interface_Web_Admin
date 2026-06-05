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
      const { getAllHistory } = await import('../services/firebaseService.js');

      const healthData = await getAllHistory({
        limit: 5000,
        collarId: sheepId || undefined,
        from: startDate,
        to: endDate,
      });

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
      const { getAllHistory } = await import('../services/firebaseService.js');
      const raw = await getAllHistory({ limit: 5000, from: startDate, to: endDate });

      // Regrouper par animal et par jour (équivalent du aggregate MongoDB)
      const grouped = {};
      for (const entry of raw) {
        const date = (entry.rx_time || '').slice(0, 10);
        const key = `${entry.collar_id}__${date}`;
        if (!grouped[key]) {
          grouped[key] = { sheepId: entry.collar_id, date, temps: [], movements: [], count: 0 };
        }
        if (entry.sensors?.temperature != null) grouped[key].temps.push(entry.sensors.temperature);
        if (entry.sensors?.movement_g != null) grouped[key].movements.push(entry.sensors.movement_g);
        grouped[key].count++;
      }

      const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
      const analyticsData = Object.values(grouped).map(g => ({
        _id: { sheepId: g.sheepId, date: g.date },
        avgTemperature: avg(g.temps),
        avgMovement: avg(g.movements),
        count: g.count,
      })).sort((a, b) => a._id.date.localeCompare(b._id.date));

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
      const { getAllAnimals, getAllHistory } = await import('../services/firebaseService.js');

      const [animals, records] = await Promise.all([
        getAllAnimals(),
        getAllHistory({ limit: 5000, from: startDate, to: endDate }),
      ]);

      const temps = records.map(r => r.sensors?.temperature).filter(v => v != null);
      const movements = records.map(r => r.sensors?.movement_g).filter(v => v != null);
      const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

      const healthStats = {
        avgTemperature: avg(temps),
        minTemperature: temps.length ? Math.min(...temps) : null,
        maxTemperature: temps.length ? Math.max(...temps) : null,
        avgMovement: avg(movements),
      };

      const alerts = {
        highTemperature: temps.filter(t => t > 40.5).length,
        lowTemperature: temps.filter(t => t < 38.0).length,
      };

      res.json({
        success: true,
        data: {
          period: { startDate, endDate },
          summary: { totalSheep: animals.length, totalRecords: records.length },
          health: healthStats,
          activityDistribution: [],
          alerts,
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
