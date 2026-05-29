import io from 'socket.io-client';

// The backend server URL (Socket.io)
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_WS_URL ||
  'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // We connect manually when user is authenticated
});

export const connectSocket = (token) => {
  if (socket.connected) return;

  socket.auth = { token };

  if (!socket.active) {
    socket.connect();
  }

  socket.off('connect');
  socket.off('disconnect');

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
