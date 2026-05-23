/**
 * Smart Shepherd - Weather Service
 * Service météo avec intégration OpenWeatherMap
 */

import axios from 'axios';
import { logger } from '../utils/errorLogger.js';

class WeatherService {
  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1';
    this.archiveUrl = 'https://archive-api.open-meteo.com/v1';
    this.geocodingUrl = 'https://geocoding-api.open-meteo.com/v1';
    this.cache = new Map();
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes cache
  }

  /**
   * Obtenir la météo actuelle pour des coordonnées GPS
   */
  async getCurrentWeather(lat, lon) {
    try {
      const cacheKey = `current_${lat}_${lon}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      const [weatherResponse, locationResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/forecast`, {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code',
            daily: 'sunrise,sunset',
            timezone: 'auto',
            forecast_days: 1
          },
          timeout: 15000
        }),
        axios.get(`${this.geocodingUrl}/reverse`, {
          params: {
            latitude: lat,
            longitude: lon,
            count: 1,
            language: 'fr',
            format: 'json'
          },
          timeout: 15000
        })
      ]);

      const weatherData = this.buildCurrentWeatherData(
        weatherResponse.data,
        locationResponse.data,
        lat,
        lon
      );

      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: weatherData
      });

      return weatherData;
    } catch (error) {
      logger.error(`Erreur récupération météo actuelle: ${error?.message || 'unknown error'}`);
      return {
        location: { name: 'Coordonnées GPS', country: '', lat, lon },
        current: { temp: 20, feelsLike: 22, humidity: 50, pressure: 1013, windSpeed: 10, windDirection: 0, visibility: 10, cloudiness: 0 },
        weather: { main: 'Clear', description: 'Ciel dégagé', icon: '01d' },
        sun: { sunrise: new Date().toISOString(), sunset: new Date().toISOString() },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtenir la prévision météo (données réelles Open-Meteo)
   */
  async getForecast(lat, lon) {
    try {
      const cacheKey = `forecast_${lat}_${lon}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          latitude: lat,
          longitude: lon,
          daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weather_code',
          hourly: 'relative_humidity_2m',
          timezone: 'auto',
          forecast_days: 7
        },
        timeout: 15000
      });

      const weatherData = this.buildForecastData(response.data, lat, lon);

      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: weatherData
      });

      return weatherData;
    } catch (error) {
      logger.error(`Erreur récupération prévision météo: ${error?.message || 'unknown error'}`);
      throw new Error('Impossible de récupérer la prévision météo');
    }
  }

  /**
   * Obtenir l'historique météo réel via l'API d'archive Open-Meteo
   */
  async getHistoricalWeather(lat, lon, startDate, endDate) {
    try {
      const response = await axios.get(`${this.archiveUrl}/archive`, {
        params: {
          latitude: lat,
          longitude: lon,
          start_date: startDate,
          end_date: endDate,
          daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code',
          hourly: 'relative_humidity_2m',
          timezone: 'auto'
        },
        timeout: 20000
      });

      return this.buildHistoricalData(response.data);
    } catch (error) {
      logger.error(`Erreur récupération historique météo: ${error?.message || 'unknown error'}`);
      throw new Error('Impossible de récupérer l\'historique météo');
    }
  }

  async fetchLocation(lat, lon) {
    try {
      const response = await axios.get(`${this.geocodingUrl}/reverse`, {
        params: {
          latitude: lat,
          longitude: lon,
          count: 1,
          language: 'fr',
          format: 'json'
        },
        timeout: 10000
      });

      const location = response.data?.results?.[0];
      if (!location) {
        return {
          name: 'Coordonnées GPS',
          country: '',
          lat,
          lon
        };
      }

      return {
        name: location.name || location.admin1 || 'Coordonnées GPS',
        country: location.country_code?.toUpperCase() || location.country || '',
        lat: location.latitude ?? lat,
        lon: location.longitude ?? lon
      };
    } catch (error) {
      logger.warn('Reverse geocoding indisponible:', error.message);
      return {
        name: 'Coordonnées GPS',
        country: '',
        lat,
        lon
      };
    }
  }

  buildCurrentWeatherData(apiData, locationData, lat, lon) {
    const current = apiData.current || {};
    const daily = apiData.daily || {};
    const weather = this.mapWeatherCode(current.weather_code);

    return {
      location: locationData?.results?.[0] ? {
        name: locationData.results[0].name || locationData.results[0].admin1 || 'Coordonnées GPS',
        country: locationData.results[0].country_code?.toUpperCase() || locationData.results[0].country || '',
        lat: locationData.results[0].latitude ?? lat,
        lon: locationData.results[0].longitude ?? lon
      } : {
        name: 'Coordonnées GPS',
        country: '',
        lat,
        lon
      },
      current: {
        temp: Math.round(current.temperature_2m ?? 0),
        feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        pressure: Math.round(current.pressure_msl ?? 0),
        windSpeed: Math.round(current.wind_speed_10m ?? 0),
        windDirection: Math.round(current.wind_direction_10m ?? 0),
        visibility: Math.round(current.visibility ?? 0),
        cloudiness: Math.round(current.cloud_cover ?? 0)
      },
      weather,
      sun: {
        sunrise: daily.sunrise?.[0] || '',
        sunset: daily.sunset?.[0] || ''
      },
      timestamp: current.time ? new Date(current.time).toISOString() : new Date().toISOString()
    };
  }

  buildForecastData(apiData, lat, lon) {
    const daily = apiData.daily || {};
    const humidityMap = this.buildHumidityMap(apiData.hourly);

    return (daily.time || []).map((date, index) => {
      const minTemp = daily.temperature_2m_min?.[index] ?? 0;
      const maxTemp = daily.temperature_2m_max?.[index] ?? 0;
      const meanTemp = daily.temperature_2m_mean?.[index] ?? (minTemp + maxTemp) / 2;
      const weather = this.mapWeatherCode(daily.weather_code?.[index]);

      return {
        date,
        temp: {
          min: Math.round(minTemp),
          max: Math.round(maxTemp),
          avg: Math.round(meanTemp)
        },
        humidity: Math.round(humidityMap[date] ?? 0),
        windSpeed: Math.round(daily.wind_speed_10m_max?.[index] ?? 0),
        condition: weather.main,
        location: {
          lat,
          lon
        }
      };
    });
  }

  buildHistoricalData(apiData) {
    const daily = apiData.daily || {};
    const humidityMap = this.buildHumidityMap(apiData.hourly);

    return (daily.time || []).map((date, index) => {
      const minTemp = daily.temperature_2m_min?.[index] ?? 0;
      const maxTemp = daily.temperature_2m_max?.[index] ?? 0;
      const meanTemp = daily.temperature_2m_mean?.[index] ?? (minTemp + maxTemp) / 2;
      const weather = this.mapWeatherCode(daily.weather_code?.[index]);

      return {
        date,
        temp: Math.round(meanTemp),
        humidity: Math.round(humidityMap[date] ?? 0),
        windSpeed: Math.round(daily.wind_speed_10m_max?.[index] ?? 0),
        precipitation: Math.round(daily.precipitation_sum?.[index] ?? 0),
        condition: weather.main,
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp)
      };
    });
  }

  buildHumidityMap(hourly = {}) {
    const humidityByDay = {};
    const countsByDay = {};
    const times = hourly.time || [];
    const humidities = hourly.relative_humidity_2m || [];

    times.forEach((time, index) => {
      const date = time.split('T')[0];
      const value = humidities[index];
      if (typeof value !== 'number') return;

      humidityByDay[date] = (humidityByDay[date] || 0) + value;
      countsByDay[date] = (countsByDay[date] || 0) + 1;
    });

    return Object.entries(humidityByDay).reduce((acc, [date, total]) => {
      acc[date] = total / countsByDay[date];
      return acc;
    }, {});
  }

  mapWeatherCode(code = 0) {
    if (code === 0) {
      return { main: 'Clear', description: 'Ciel dégagé', icon: '01d' };
    }
    if (code === 1 || code === 2) {
      return { main: 'Clouds', description: code === 1 ? 'Peu nuageux' : 'Partiellement nuageux', icon: '02d' };
    }
    if (code === 3) {
      return { main: 'Clouds', description: 'Couvert', icon: '04d' };
    }
    if ([45, 48].includes(code)) {
      return { main: 'Fog', description: 'Brouillard', icon: '50d' };
    }
    if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code)) {
      return { main: 'Rain', description: 'Pluie', icon: '10d' };
    }
    if ([71, 73, 75, 77].includes(code)) {
      return { main: 'Snow', description: 'Neige', icon: '13d' };
    }
    if ([95, 96, 99].includes(code)) {
      return { main: 'Thunderstorm', description: 'Orage', icon: '11d' };
    }
    return { main: 'Clouds', description: 'Temps variable', icon: '03d' };
  }

  /**
   * Analyser les données météo actuelles
   */
  parseCurrentWeather(data) {
    return {
      location: {
        name: data.name,
        country: data.sys.country,
        lat: data.coord.lat,
        lon: data.coord.lon
      },
      current: {
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg,
        visibility: data.visibility / 1000, // Convert to km
        cloudiness: data.clouds.all
      },
      weather: {
        main: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon
      },
      sun: {
        sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
        sunset: new Date(data.sys.sunset * 1000).toISOString()
      },
      timestamp: new Date(data.dt * 1000).toISOString()
    };
  }

  /**
   * Analyser les données de prévision
   */
  parseForecast(data) {
    const dailyForecast = {};

    data.list.forEach(item => {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];

      if (!dailyForecast[date]) {
        dailyForecast[date] = {
          date,
          temps: [],
          humidity: [],
          windSpeed: [],
          conditions: []
        };
      }

      dailyForecast[date].temps.push(item.main.temp);
      dailyForecast[date].humidity.push(item.main.humidity);
      dailyForecast[date].windSpeed.push(item.wind.speed);
      dailyForecast[date].conditions.push(item.weather[0].main);
    });

    return Object.values(dailyForecast).map(day => ({
      date: day.date,
      temp: {
        min: Math.round(Math.min(...day.temps)),
        max: Math.round(Math.max(...day.temps)),
        avg: Math.round(day.temps.reduce((a, b) => a + b, 0) / day.temps.length)
      },
      humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
      windSpeed: Math.round(day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length),
      condition: this.getMostFrequentCondition(day.conditions)
    }));
  }

  /**
   * Obtenir la condition la plus fréquente
   */
  getMostFrequentCondition(conditions) {
    const counts = conditions.reduce((acc, condition) => {
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Obtenir une condition aléatoire pour la simulation
   */
  getRandomCondition() {
    const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Thunderstorm'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  /**
   * Analyser les alertes météo préventives
   */
  analyzeWeatherAlerts(weatherData) {
    const alerts = [];
    const { current } = weatherData;

    // Alertes chaleur extrême
    if (current.temp > 35) {
      alerts.push({
        type: 'EXTREME_HEAT',
        severity: 'CRITICAL',
        message: 'Température extrême détectée - Risque d\'hyperthermie',
        recommendation: 'Déplacer le troupeau à l\'ombre, assurer l\'accès à l\'eau',
        value: current.temp
      });
    } else if (current.temp > 30) {
      alerts.push({
        type: 'HIGH_HEAT',
        severity: 'WARNING',
        message: 'Température élevée - Surveillance recommandée',
        recommendation: 'Surveiller l\'hydratation et l\'activité',
        value: current.temp
      });
    }

    // Alertes gel
    if (current.temp < 0) {
      alerts.push({
        type: 'FREEZE',
        severity: 'CRITICAL',
        message: 'Température négative - Risque de gel',
        recommendation: 'Rentrer le troupeau dans un abri',
        value: current.temp
      });
    } else if (current.temp < 5) {
      alerts.push({
        type: 'COLD',
        severity: 'WARNING',
        message: 'Température basse - Protection recommandée',
        recommendation: 'Surveiller l\'état des animaux',
        value: current.temp
      });
    }

    // Alertes précipitations
    if (weatherData.weather.main === 'Rain' || weatherData.weather.main === 'Thunderstorm') {
      alerts.push({
        type: 'HEAVY_RAIN',
        severity: 'WARNING',
        message: 'Pluie détectée - Activité réduite attendue',
        recommendation: 'Surveiller le comportement du troupeau',
        value: weatherData.weather.main
      });
    }

    // Alertes vent fort
    if (current.windSpeed > 20) {
      alerts.push({
        type: 'HIGH_WIND',
        severity: 'WARNING',
        message: 'Vent fort détecté',
        recommendation: 'Surveiller les déplacements',
        value: current.windSpeed
      });
    }

    return alerts;
  }

  /**
   * Corréler météo avec comportement animal
   */
  correlateWeatherWithBehavior(weatherData, telemetryData) {
    const correlations = [];
    const { current, weather } = weatherData;

    // Pluie → activité réduite
    if (weather.main === 'Rain' || weather.main === 'Thunderstorm') {
      const avgActivity = telemetryData.reduce((sum, d) => sum + (d.activity === 'grazing' ? 1 : 0), 0) / telemetryData.length;

      if (avgActivity < 0.3) {
        correlations.push({
          type: 'RAIN_ACTIVITY',
          description: 'Activité réduite due à la pluie',
          weatherCondition: weather.main,
          expectedBehavior: 'Repos / Abri',
          actualBehavior: avgActivity < 0.3 ? 'Conforme' : 'Anormal'
        });
      }
    }

    // Chaleur → activité réduite pendant la journée
    if (current.temp > 30) {
      const hour = new Date().getHours();
      if (hour >= 10 && hour <= 16) {
        correlations.push({
          type: 'HEAT_ACTIVITY',
          description: 'Activité réduite due à la chaleur',
          weatherCondition: `Temp: ${current.temp}°C`,
          expectedBehavior: 'Repos à l\'ombre',
          recommendation: 'Surveiller l\'hydratation'
        });
      }
    }

    // Vent fort → déplacements réduits
    if (current.windSpeed > 15) {
      correlations.push({
        type: 'WIND_ACTIVITY',
        description: 'Activité potentiellement réduite due au vent',
        weatherCondition: `Vent: ${current.windSpeed} m/s`,
        expectedBehavior: 'Déplacements limités'
      });
    }

    return correlations;
  }

  /**
   * Nettoyer le cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Cache météo nettoyé');
  }

  /**
   * Obtenir les statistiques météo pour une période
   */
  async getWeatherStatistics(lat, lon, startDate, endDate) {
    try {
      const historicalData = await this.getHistoricalWeather(lat, lon, startDate, endDate);

      const stats = {
        avgTemp: historicalData.reduce((sum, d) => sum + d.temp, 0) / historicalData.length,
        maxTemp: Math.max(...historicalData.map(d => d.temp)),
        minTemp: Math.min(...historicalData.map(d => d.temp)),
        avgHumidity: historicalData.reduce((sum, d) => sum + d.humidity, 0) / historicalData.length,
        totalPrecipitation: historicalData.reduce((sum, d) => sum + d.precipitation, 0),
        rainyDays: historicalData.filter(d => d.precipitation > 0).length,
        conditionDistribution: historicalData.reduce((acc, d) => {
          acc[d.condition] = (acc[d.condition] || 0) + 1;
          return acc;
        }, {})
      };

      return stats;
    } catch (error) {
      logger.error('Erreur récupération statistiques météo:', error);
      throw new Error('Impossible de récupérer les statistiques météo');
    }
  }
}

export default new WeatherService();
