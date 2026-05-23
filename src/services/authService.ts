import api from './api';
import { clearStoredToken } from '../utils/authStorage';

/**
 * AuthService — Handles JWT authentication with the Node.js backend.
 */
const authService = {
  login: async (email: string, password: string): Promise<{ user: any; token: string }> => {
    // Backend expects username, so use email as username if no username provided
    const response = await api.post('/auth/login', {
      username: email,
      password
    });
    return response.data; // Expecting { user, token }
  },

  register: async (userData: any): Promise<any> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getProfile: async (): Promise<{ user: any }> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  logout: () => {
    clearStoredToken();
  }
};

export default authService;
