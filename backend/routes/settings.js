import express from 'express';
import authMiddleware, { authorize } from '../middleware/auth.js';

const router = express.Router();

let mqttSettings = {
    mqttHost: process.env.MQTT_BROKER_URL || 'wss://test.mosquitto.org',
    mqttPort: process.env.MQTT_PORT || '8081',
    mqttUser: process.env.MQTT_USERNAME || '',
    mqttPass: process.env.MQTT_PASSWORD || '',
    updatedAt: new Date().toISOString(),
};

router.get('/mqtt', authMiddleware, authorize('admin', 'operator'), (_req, res) => {
    res.json({ success: true, data: mqttSettings });
});

router.put('/mqtt', authMiddleware, authorize('admin', 'operator'), (req, res) => {
    const { mqttHost, mqttPort, mqttUser, mqttPass } = req.body || {};

    mqttSettings = {
        mqttHost: mqttHost || mqttSettings.mqttHost,
        mqttPort: mqttPort || mqttSettings.mqttPort,
        mqttUser: typeof mqttUser === 'string' ? mqttUser : mqttSettings.mqttUser,
        mqttPass: typeof mqttPass === 'string' ? mqttPass : mqttSettings.mqttPass,
        updatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: mqttSettings });
});

export default router;