import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FARMER: 'FARMER',
  ADMIN: 'ADMIN',
};

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState(null);

  // Enhanced session verification with timeout handling
  const verifySession = useCallback(async () => {
    // Development helper: if no token and DEV mode enabled, optionally mock a user
    if (!token && import.meta.env.DEV && localStorage.getItem('DEV_MOCK_USER') === '1') {
      setUser({ id: 'dev', name: 'Dev User', role: USER_ROLES.SUPER_ADMIN });
      setLoading(false);
      return;
    }

    if (token) {
      try {
        // Check token expiry before making request
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (decodedToken.exp && decodedToken.exp < currentTime) {
          console.warn('Token expired during verification');
          logout();
          return;
        }

        const data = await authService.getProfile();
        setUser(data.user);
        
        // Set session timeout to logout user when token expires
        if (decodedToken.exp) {
          const timeUntilExpiry = (decodedToken.exp - currentTime) * 1000;
          const timeoutId = setTimeout(() => {
            console.warn('Session expired due to timeout');
            logout();
          }, timeUntilExpiry);
          setSessionTimeout(timeoutId);
        }
      } catch (error) {
        console.error('Session verification failed:', error);
        logout();
      }
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Enhanced unauthorized event handler
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('Session expirée ou non autorisée');
      logout();
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  // Enhanced login with better error handling
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      const { user: loggedUser, token: newToken } = await authService.login(
        credentials.email,
        credentials.password
      );
      
      // Store token securely
      setToken(newToken);
      localStorage.setItem('token', newToken);
      setUser(loggedUser);
      
      // Clear any existing session timeout
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
      
      // Set new session timeout
      const decodedToken = JSON.parse(atob(newToken.split('.')[1]));
      if (decodedToken.exp) {
        const currentTime = Date.now() / 1000;
        const timeUntilExpiry = (decodedToken.exp - currentTime) * 1000;
        const timeoutId = setTimeout(() => {
          console.warn('Session expired - automatic logout');
          logout();
        }, timeUntilExpiry);
        setSessionTimeout(timeoutId);
      }
      
      return { success: true, user: loggedUser };
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
      
      // Enhanced error messages
      let errorMessage = 'Erreur de connexion';
      if (error.response?.status === 401) {
        errorMessage = 'Identifiants invalides';
      } else if (error.response?.status === 429) {
        errorMessage = 'Trop de tentatives, veuillez réessayer plus tard';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Erreur réseau, vérifiez votre connexion';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }, [sessionTimeout]);

  // Enhanced logout with proper cleanup
  const logout = useCallback(() => {
    try {
      // Clear session timeout
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        setSessionTimeout(null);
      }
      
      // Call service logout
      authService.logout();
      
      // Clear local state
      setUser(null);
      setToken(null);
      setLoading(false);
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('DEV_MOCK_USER');
      
      // Emit logout event for other components
      window.dispatchEvent(new CustomEvent('auth:logout'));
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, [sessionTimeout]);

  // Token refresh mechanism
  const refreshToken = useCallback(async () => {
    try {
      if (!token) return false;
      
      const response = await authService.refreshToken();
      const { token: newToken } = response;
      
      setToken(newToken);
      localStorage.setItem('token', newToken);
      
      // Update session timeout
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
      
      const decodedToken = JSON.parse(atob(newToken.split('.')[1]));
      if (decodedToken.exp) {
        const currentTime = Date.now() / 1000;
        const timeUntilExpiry = (decodedToken.exp - currentTime) * 1000;
        const timeoutId = setTimeout(() => {
          logout();
        }, timeUntilExpiry);
        setSessionTimeout(timeoutId);
      }
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  }, [token, logout, sessionTimeout]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading, 
      refreshToken,
      isAuthenticated: !!user && !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
