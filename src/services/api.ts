import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import logger from '../utils/logger';
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/authStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Interceptor to handle refreshed tokens and 401 Unauthorized
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Check for a new access token sent by the backend during auto-refresh
    const newAccessToken = response.headers['x-new-access-token'];
    if (newAccessToken) {
      logger.log('Access token refreshed automatically by server');
      setStoredToken(newAccessToken);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      // Clear token on unauthorized access
      clearStoredToken();
      // Dispatch custom event to trigger logout in AuthContext
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
