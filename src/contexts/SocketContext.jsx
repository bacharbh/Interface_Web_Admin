import React, { createContext, useContext, useEffect, useState } from 'react';
import { socket, connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  
  // Real-time states
  const [positions, setPositions] = useState({});
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (token) {
      connectSocket(token);
      
      socket.on('connect', () => setIsConnected(true));
      socket.on('disconnect', () => setIsConnected(false));
      
      // Listen for IoT data forwarded by backend
      socket.on('new_position', (data) => {
        // data payload example: { collar_id: 'C001', lat: 34.0, lng: -5.0 }
        setPositions((prev) => ({
          ...prev,
          [data.collar_id]: data
        }));
      });

      // Listen to alerts (Out of zone, low battery, etc)
      socket.on('new_alert', (alertData) => {
        setAlerts((prev) => [alertData, ...prev]);
      });
      
    } else {
      disconnectSocket();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_position');
      socket.off('new_alert');
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, positions, alerts }}>
      {children}
    </SocketContext.Provider>
  );
};
