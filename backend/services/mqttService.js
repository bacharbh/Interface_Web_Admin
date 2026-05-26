import mqtt from 'mqtt';
import winston from 'winston';
import aiService from './aiHealthPrediction.js';
import fs from 'fs';

let mqttClient = null;
let io = null;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

export const initializeMQTT = (socketIO) => {
  io = socketIO;

  const brokerUrl = process.env.MQTT_BROKER_URL || process.env.MQTT_BROKER;
  const mqttEnabled = !!brokerUrl && brokerUrl !== 'disabled';

  if (!mqttEnabled) {
    logger.info('[MQTT] disabled in this environment');
    return;
  }

  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;

  // Middleware-like validation to reject connection without credentials
  if (!username || !password) {
    logger.error('MQTT Connection Rejected: Missing MQTT_USERNAME or MQTT_PASSWORD in environment variables.');
    return;
  }

  const options = {
    clientId: `smart-shepherd-server-${Date.now()}`,
    clean: true,
    connectTimeout: 30 * 1000,
    reconnectPeriod: 1000,
    username: username,
    password: password,
    rejectUnauthorized: true, // Requires valid TLS certificate
  };

  // Load TLS certificates if configured
  if (process.env.MQTT_CA) {
    try {
      options.ca = [fs.readFileSync(process.env.MQTT_CA)];
    } catch (error) {
      logger.error('Failed to read MQTT CA certificate:', error.message);
    }
  }

  if (process.env.MQTT_CERT && process.env.MQTT_KEY) {
    try {
      options.cert = fs.readFileSync(process.env.MQTT_CERT);
      options.key = fs.readFileSync(process.env.MQTT_KEY);
    } catch (error) {
      logger.error('Failed to read MQTT client certificate/key:', error.message);
    }
  }

  mqttClient = mqtt.connect(brokerUrl, options);

  mqttClient.on('connect', () => {
    logger.info('Connected to MQTT broker');

    // Subscribe to relevant topics
    subscribeToTopics();
  });

  mqttClient.on('error', (err) => {
    logger.error('MQTT connection error:', err);
  });

  mqttClient.on('reconnect', () => {
    logger.info('Reconnecting to MQTT broker...');
  });

  mqttClient.on('close', () => {
    logger.info('MQTT connection closed');
  });

  // Handle incoming messages
  mqttClient.on('message', (topic, message) => {
    handleIncomingMessage(topic, message);
  });
};

const subscribeToTopics = () => {
  const topics = [
    'shepherd/+/telemetry',      // Device telemetry data
    'shepherd/+/location',      // Location updates
    'shepherd/+/alerts',        // Alert notifications
    'shepherd/+/status',        // Device status
    'shepherd/+/heartbeat',     // Device heartbeat
    'shepherd/system/+',        // System messages
    'shepherd/commands/+'       // Command responses
  ];

  topics.forEach(topic => {
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${topic}:`, err);
      } else {
        logger.info(`Subscribed to ${topic}`);
      }
    });
  });
};

const handleIncomingMessage = (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const topicParts = topic.split('/');
    const deviceId = topicParts[1];
    const messageType = topicParts[2];

    logger.info(`Received message from ${deviceId}: ${messageType}`, data);

    switch (messageType) {
      case 'telemetry':
        handleTelemetryData(deviceId, data);
        break;
      case 'location':
        handleLocationUpdate(deviceId, data);
        break;
      case 'alerts':
        handleAlert(deviceId, data);
        break;
      case 'status':
        handleDeviceStatus(deviceId, data);
        break;
      case 'heartbeat':
        handleHeartbeat(deviceId, data);
        break;
      default:
        logger.warn(`Unknown message type: ${messageType}`);
    }
  } catch (error) {
    logger.error(`Error processing MQTT message from ${topic}:`, error);
  }
};

const handleTelemetryData = async (deviceId, data) => {
  try {
    // Forward telemetry data to the telemetry endpoint
    // This would typically be processed by the telemetry service
    if (io) {
      io.emit('mqtt:telemetry', {
        deviceId,
        timestamp: new Date(),
        data
      });
    }

    // Check for threshold violations and generate alerts
    const alerts = [];

    if (data.heartRate && (data.heartRate < 60 || data.heartRate > 120)) {
      alerts.push({
        type: 'heart_rate',
        severity: data.heartRate < 60 ? 'low' : 'high',
        value: data.heartRate,
        deviceId,
        timestamp: new Date()
      });
    }

    if (data.temperature && (data.temperature < 38.5 || data.temperature > 40.5)) {
      alerts.push({
        type: 'temperature',
        severity: data.temperature < 38.5 ? 'low' : 'high',
        value: data.temperature,
        deviceId,
        timestamp: new Date()
      });
    }

    if (data.batteryLevel && data.batteryLevel < 20) {
      alerts.push({
        type: 'battery',
        severity: 'low',
        value: data.batteryLevel,
        deviceId,
        timestamp: new Date()
      });
    }

    // AI-Driven Advanced Analysis
    try {
      if (!aiService.isInitialized) {
        await aiService.initialize();
      }

      // Detect anomalies using local TF.js model
      const anomalyResult = await aiService.detectAnomalies(deviceId);

      if (anomalyResult && anomalyResult.isAnomaly) {
        alerts.push({
          type: 'ai_anomaly',
          severity: anomalyResult.confidence > 0.8 ? 'CRITICAL' : 'WARNING',
          value: anomalyResult.label,
          deviceId,
          timestamp: new Date(),
          description: `AI detected ${anomalyResult.label} behavior (${(anomalyResult.confidence * 100).toFixed(0)}% confidence)`
        });
      }

      // Get high-level risk score
      const riskResult = await aiService.calculateRiskScore(deviceId);
      if (riskResult && riskResult.overallScore > 70) {
        alerts.push({
          type: 'ai_risk',
          severity: riskResult.level === 'critical' ? 'CRITICAL' : 'WARNING',
          value: riskResult.overallScore,
          deviceId,
          timestamp: new Date(),
          description: `High health risk detected: ${riskResult.mainContributor}`
        });
      }
    } catch (aiError) {
      logger.warn(`AI analysis failed for ${deviceId}:`, aiError.message);
    }

    // Emit alerts if any
    if (alerts.length > 0 && io) {
      io.emit('mqtt:alerts', alerts);
    }

  } catch (error) {
    logger.error(`Error handling telemetry data from ${deviceId}:`, error);
  }
};

const handleLocationUpdate = async (deviceId, data) => {
  try {
    if (io) {
      io.emit('mqtt:location', {
        deviceId,
        timestamp: new Date(),
        location: data
      });
    }

    // Check geofence violations
    // This would typically trigger geofence checking logic
    if (data.coordinates && io) {
      io.emit('mqtt:geofence-check', {
        deviceId,
        coordinates: data.coordinates,
        timestamp: new Date()
      });
    }

  } catch (error) {
    logger.error(`Error handling location update from ${deviceId}:`, error);
  }
};

const handleAlert = (deviceId, data) => {
  try {
    if (io) {
      io.emit('mqtt:device-alert', {
        deviceId,
        timestamp: new Date(),
        alert: data
      });
    }

    logger.warn(`Device alert from ${deviceId}:`, data);

  } catch (error) {
    logger.error(`Error handling alert from ${deviceId}:`, error);
  }
};

const handleDeviceStatus = (deviceId, data) => {
  try {
    if (io) {
      io.emit('mqtt:device-status', {
        deviceId,
        timestamp: new Date(),
        status: data
      });
    }

    logger.info(`Device status update from ${deviceId}:`, data);

  } catch (error) {
    logger.error(`Error handling device status from ${deviceId}:`, error);
  }
};

const handleHeartbeat = (deviceId, data) => {
  try {
    if (io) {
      io.emit('mqtt:heartbeat', {
        deviceId,
        timestamp: new Date(),
        heartbeat: data
      });
    }

    // Update device last seen timestamp
    // This would typically update the device record in the database

  } catch (error) {
    logger.error(`Error handling heartbeat from ${deviceId}:`, error);
  }
};

// Function to publish commands to devices
export const publishCommand = (deviceId, command, payload) => {
  if (!mqttClient || !mqttClient.connected) {
    logger.error('MQTT client not connected');
    return false;
  }

  const topic = `shepherd/${deviceId}/commands/${command}`;
  const message = JSON.stringify(payload);

  mqttClient.publish(topic, message, (err) => {
    if (err) {
      logger.error(`Failed to publish command to ${deviceId}:`, err);
    } else {
      logger.info(`Command published to ${deviceId}: ${command}`);
    }
  });

  return true;
};

// Function to broadcast system messages
export const broadcastSystemMessage = (messageType, payload) => {
  if (!mqttClient || !mqttClient.connected) {
    logger.error('MQTT client not connected');
    return false;
  }

  const topic = `shepherd/system/${messageType}`;
  const message = JSON.stringify(payload);

  mqttClient.publish(topic, message, (err) => {
    if (err) {
      logger.error(`Failed to broadcast system message:`, err);
    } else {
      logger.info(`System message broadcasted: ${messageType}`);
    }
  });

  return true;
};

// Get MQTT connection status
export const getConnectionStatus = () => {
  return {
    connected: mqttClient ? mqttClient.connected : false,
    reconnecting: mqttClient ? mqttClient.reconnecting : false
  };
};

// Disconnect MQTT client
export const disconnectMQTT = () => {
  if (mqttClient) {
    mqttClient.end();
    logger.info('MQTT client disconnected');
  }
};
