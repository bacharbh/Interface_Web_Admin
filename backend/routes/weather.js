/**
 * Smart Shepherd - Weather API Routes
 * Routes pour les données météo et alertes
 */

import express from 'express';
import weatherService from '../services/weatherService.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/weather/current
 * Obtenir la météo actuelle pour des coordonnées
 */
router.get('/current',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées lat et lon requises'
        });
      }

      const weatherData = await weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lon));

      res.json({
        success: true,
        data: weatherData
      });
    } catch (error) {
      console.error('Erreur météo actuelle:', error);
      res.json({
        success: true,
        fallback: true,
        data: {
          location: {
            name: 'Grenoble',
            country: 'FR',
            lat: parseFloat(req.query.lat),
            lon: parseFloat(req.query.lon)
          },
          current: {
            temp: 21,
            feelsLike: 21,
            humidity: 60,
            pressure: 1015,
            windSpeed: 8,
            windDirection: 180,
            visibility: 10,
            cloudiness: 35
          },
          weather: {
            main: 'Clouds',
            description: 'Météo simulée (fallback local)',
            icon: '03d'
          },
          sun: {
            sunrise: new Date().toISOString(),
            sunset: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
          },
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * GET /api/weather/forecast
 * Obtenir la prévision météo
 */
router.get('/forecast',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées lat et lon requises'
        });
      }

      const forecastData = await weatherService.getForecast(parseFloat(lat), parseFloat(lon));

      res.json({
        success: true,
        data: forecastData
      });
    } catch (error) {
      console.error('Erreur prévision météo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/weather/historical
 * Obtenir l'historique météo
 */
router.get('/historical',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon, startDate, endDate } = req.query;

      if (!lat || !lon || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées et dates requises'
        });
      }

      const historicalData = await weatherService.getHistoricalWeather(
        parseFloat(lat),
        parseFloat(lon),
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: historicalData
      });
    } catch (error) {
      console.error('Erreur historique météo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/weather/alerts
 * Obtenir les alertes météo préventives
 */
router.get('/alerts',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées lat et lon requises'
        });
      }

      const weatherData = await weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lon));
      const alerts = weatherService.analyzeWeatherAlerts(weatherData);

      res.json({
        success: true,
        data: {
          weather: weatherData,
          alerts,
          alertCount: alerts.length
        }
      });
    } catch (error) {
      console.error('Erreur alertes météo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/weather/correlation
 * Corréler météo avec comportement animal
 */
router.get('/correlation',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon, startDate, endDate } = req.query;

      if (!lat || !lon) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées lat et lon requises'
        });
      }

      const weatherData = await weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lon));

      // Récupérer les données de télémétrie pour la corrélation
      const TelemetryData = (await import('../models/TelemetryData.js')).default;
      const query = {
        timestamp: {
          $gte: new Date(startDate || Date.now() - 24 * 60 * 60 * 1000),
          $lte: new Date(endDate || Date.now())
        }
      };

      const telemetryData = await TelemetryData.find(query).lean();

      const correlations = weatherService.correlateWeatherWithBehavior(weatherData, telemetryData);

      res.json({
        success: true,
        data: {
          weather: weatherData,
          correlations,
          telemetryCount: telemetryData.length
        }
      });
    } catch (error) {
      console.error('Erreur corrélation météo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/weather/statistics
 * Obtenir les statistiques météo pour une période
 */
router.get('/statistics',
  authenticate,
  requireRole('admin', 'viewer'),
  async (req, res) => {
    try {
      const { lat, lon, startDate, endDate } = req.query;

      if (!lat || !lon || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Coordonnées et dates requises'
        });
      }

      const stats = await weatherService.getWeatherStatistics(
        parseFloat(lat),
        parseFloat(lon),
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erreur statistiques météo:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/weather/cache/clear
 * Nettoyer le cache météo
 */
router.post('/cache/clear',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      weatherService.clearCache();

      res.json({
        success: true,
        message: 'Cache météo nettoyé'
      });
    } catch (error) {
      console.error('Erreur nettoyage cache:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
