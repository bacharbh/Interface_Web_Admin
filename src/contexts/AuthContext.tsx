import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import authService from '../services/authService';
import logger from '../utils/logger';
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '../utils/authStorage';

export const USER_ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean }>;
  logout: () => void;
  loading: boolean;
  expiresAt: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Utility to decode JWT token
const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const logout = () => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    // Clear every token location so the session ends on tab close and on logout.
    clearStoredToken();
    authService.logout();
    setUser(null);
    setToken(null);
    setExpiresAt(null);
  };

  const setupSessionTimer = (tokenStr: string) => {
    const payload = decodeJWT(tokenStr);
    if (!payload || !payload.exp) return;

    const expirationTime = payload.exp * 1000; // Convert to ms
    const currentTime = Date.now();
    const delay = expirationTime - currentTime;

    setExpiresAt(expirationTime);

    if (delay <= 0) {
      logout();
      return;
    }

    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = setTimeout(() => {
      logger.warn('Session automatiquement expirée (JWT)');
      logout();
    }, delay);
  };

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        const payload = decodeJWT(token);
        if (!payload || (payload.exp * 1000) <= Date.now()) {
          logout();
          setLoading(false);
          return;
        }

        try {
          setupSessionTimer(token);
          const data = await (authService as any).getProfile();
          setUser(data.user);
        } catch (error) {
          logger.warn('Session verification failed', error);
          logout();
        }
      }

      setLoading(false);
    };

    verifySession();

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('Session expirée ou non autorisée');
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const { user: loggedUser, token: newToken } = await (authService as any).login(
        credentials.email,
        credentials.password
      );
      // HttpOnly cookies would be preferable if the backend supports them; sessionStorage is the safer client-side fallback.
      setToken(newToken);
      setStoredToken(newToken);
      setUser(loggedUser);
      setupSessionTimer(newToken);
      return { success: true };
    } catch (error) {
      logger.warn('Login failed', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, expiresAt }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for displaying warning 2 minutes before expiration
export const useSessionWarning = (onWarning: () => void) => {
  const { expiresAt, token } = useAuth();

  useEffect(() => {
    if (!expiresAt || !token) return;

    const WARNING_TIME = 2 * 60 * 1000; // 2 minutes in ms
    const timeUntilExpiration = expiresAt - Date.now();
    const timeUntilWarning = timeUntilExpiration - WARNING_TIME;

    if (timeUntilWarning > 0) {
      const warningTimer = setTimeout(() => {
        if (onWarning) onWarning();
      }, timeUntilWarning);

      return () => clearTimeout(warningTimer);
    } else if (timeUntilExpiration > 0) {
      // Already within the 2 minute window
      if (onWarning) onWarning();
    }
  }, [expiresAt, token, onWarning]);
};
