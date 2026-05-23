import mqtt, { MqttClient } from 'mqtt';

// The broker URL MUST use the WebSocket protocol (ws:// or wss://) for browser compatibility.
// Default to local Mosquitto websocket endpoint commonly used in development.
// E.g., ws://localhost:1883 or ws://localhost:9001 depending on local broker setup.
const BROKER_URL = import.meta.env.VITE_MQTT_URL || 'ws://localhost:1883';

export const connectMqtt = (username?: string, password?: string): MqttClient => {
  const client = mqtt.connect(BROKER_URL, {
    clientId: 'admin_dashboard_' + Math.random().toString(16).substring(2, 8),
    username: username,
    password: password,
    keepalive: 60,
    clean: true,
  });

  return client;
};
