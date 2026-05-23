/**
 * Smart Shepherd - Weather Service (Frontend)
 * Service météo pour le frontend connecté au backend authentifié.
 */

import axios from 'axios';
import api from './api.js';

export interface WeatherData {
  location: {
    name: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    cloudiness: number;
  };
  weather: {
    main: string;
    description: string;
    icon: string;
  };
  sun: {
    sunrise: string;
    sunset: string;
  };
  timestamp: string;
}

export interface WeatherAlert {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  recommendation: string;
  value: number | string;
}

export interface WeatherCorrelation {
  type: string;
  description: string;
  weatherCondition: string;
  expectedBehavior: string;
  actualBehavior?: string;
  recommendation?: string;
}

/**
 * Obtenir la météo actuelle
 */
export const getCurrentWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    const response = await api.get('/weather/current', {
      params: { lat, lon }
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getWeatherErrorMessage(error, 'Impossible de récupérer la météo actuelle'));
  }
};

/**
 * Obtenir la prévision météo
 */
export const getWeatherForecast = async (lat: number, lon: number): Promise<any> => {
  try {
    const response = await api.get('/weather/forecast', {
      params: { lat, lon }
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getWeatherErrorMessage(error, 'Impossible de récupérer la prévision météo'));
  }
};

/**
 * Obtenir les alertes météo
 */
export const getWeatherAlerts = async (lat: number, lon: number): Promise<{ weather: WeatherData; alerts: WeatherAlert[] }> => {
  try {
    const response = await api.get('/weather/alerts', {
      params: { lat, lon }
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getWeatherErrorMessage(error, 'Impossible de récupérer les alertes météo'));
  }
};

/**
 * Obtenir la corrélation météo/comportement
 */
export const getWeatherCorrelation = async (lat: number, lon: number, startDate?: string, endDate?: string): Promise<{ weather: WeatherData; correlations: WeatherCorrelation[] }> => {
  try {
    const response = await api.get('/weather/correlation', {
      params: { lat, lon, startDate, endDate }
    });

    return response.data.data;
  } catch (error) {
    throw new Error(getWeatherErrorMessage(error, 'Impossible de récupérer la corrélation météo'));
  }
};

const getWeatherErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: string; message?: string } | undefined)?.error ||
      (error.response?.data as { error?: string; message?: string } | undefined)?.message ||
      error.message ||
      fallbackMessage
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
};

/**
 * Obtenir l'icône météo OpenWeatherMap
 */
export const getWeatherIcon = (iconCode: string): string => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};

/**
 * Obtenir la couleur de sévérité
 */
export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500';
    case 'WARNING': return 'bg-yellow-500';
    case 'INFO': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};
