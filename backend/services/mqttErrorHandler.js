/**
 * Smart Shepherd - MQTT Error Handling Service
 * Gestion robuste des erreurs de connexion et de messages MQTT
 */

import mqtt from 'mqtt';
import AppError from '../utils/AppError.js';
import { mqttLogger } from '../utils/errorLogger.js';

class MQTTErrorHandler {
  constructor(brokerUrl, options = {}) {
    this.brokerUrl = brokerUrl;
    this.options = {
      reconnectPeriod: 5000,        // 5 secondes entre tentatives
      connectTimeout: 30000,        // 30 secondes timeout de connexion
      keepalive: 60,                // 60 secondes keepalive
      reschedulePings: true,
      clean: true,
      ...options
    };
    
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.messageQueue = [];
    this.subscribers = new Map();
    this.errorCallbacks = [];
    
    this.setupEventHandlers();
  }

  /**
   * Configuration des gestionnaires d'événements MQTT
   */
  setupEventHandlers() {
    // Gestionnaire de connexion réussie
    this.onConnect = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      mqttLogger.reconnectionSuccess(this.brokerUrl);
      
      // Resubscribe aux topics après reconnexion
      this.resubscribeAll();
      
      // Traiter la file d'attente des messages
      this.processMessageQueue();
      
      // Notifier les callbacks
      this.notifyCallbacks('connected');
    };

    // Gestionnaire d'erreur de connexion
    this.onError = (error) => {
      this.isConnected = false;
      mqttLogger.connectionError(this.brokerUrl, error);
      
      // Notifier les callbacks
      this.notifyCallbacks('error', error);
    };

    // Gestionnaire de déconnexion
    this.onClose = () => {
      this.isConnected = false;
      mqttLogger.reconnectionAttempt(this.brokerUrl, this.reconnectAttempts);
      
      // Notifier les callbacks
      this.notifyCallbacks('disconnected');
    };

    // Gestionnaire d'erreur de message
    this.onMessageError = (error) => {
      mqttLogger.messageError('', '', error);
    };

    // Gestionnaire de reconnexion offline
    this.onOffline = () => {
      this.isConnected = false;
      this.notifyCallbacks('offline');
    };

    // Gestionnaire de reconnexion
    this.onReconnect = () => {
      this.reconnectAttempts++;
      mqttLogger.reconnectionAttempt(this.brokerUrl, this.reconnectAttempts);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.handleMaxReconnectAttemptsReached();
      }
      
      this.notifyCallbacks('reconnecting');
    };
  }

  /**
   * Connexion au broker MQTT avec gestion d'erreurs
   */
  async connect() {
    try {
      this.client = mqtt.connect(this.brokerUrl, this.options);
      
      // Attacher les gestionnaires d'événements
      this.client.on('connect', this.onConnect);
      this.client.on('error', this.onError);
      this.client.on('close', this.onClose);
      this.client.on('message', this.handleMessage);
      this.client.on('offline', this.onOffline);
      this.client.on('reconnect', this.onReconnect);
      
      // Attendre la connexion ou le timeout
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            reject(AppError.mqttConnection('Timeout de connexion MQTT'));
          }
        }, this.options.connectTimeout);

        this.client.once('connect', () => {
          clearTimeout(timeout);
          resolve(this.client);
        });

        this.client.once('error', (error) => {
          clearTimeout(timeout);
          reject(AppError.mqttConnection(error.message));
        });
      });
      
    } catch (error) {
      throw AppError.mqttConnection(`Échec de connexion MQTT: ${error.message}`);
    }
  }

  /**
   * Gestionnaire de messages entrants
   */
  handleMessage = (topic, message) => {
    try {
      const messageStr = message.toString();
      const data = JSON.parse(messageStr);
      
      // Valider le message
      this.validateMessage(topic, data);
      
      // Traiter le message
      this.processMessage(topic, data);
      
    } catch (error) {
      mqttLogger.messageError(topic, message.toString(), error);
      
      // Envoyer une notification d'erreur
      this.notifyCallbacks('messageError', { topic, message: message.toString(), error });
    }
  };

  /**
   * Validation des messages MQTT
   */
  validateMessage(topic, data) {
    if (!topic || typeof topic !== 'string') {
      throw new Error('Topic invalide');
    }
    
    if (!data || typeof data !== 'object') {
      throw new Error('Message invalide: doit être un objet JSON');
    }
    
    // Validation selon le topic
    if (topic.includes('telemetry')) {
      this.validateTelemetryMessage(data);
    } else if (topic.includes('alert')) {
      this.validateAlertMessage(data);
    } else if (topic.includes('status')) {
      this.validateStatusMessage(data);
    }
  }

  /**
   * Validation des messages de télémétrie
   */
  validateTelemetryMessage(data) {
    const required = ['deviceId', 'timestamp', 'location'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Champ requis manquant: ${field}`);
      }
    }
    
    if (!data.location.lat || !data.location.lng) {
      throw new Error('Coordonnées GPS incomplètes');
    }
    
    if (data.battery && (data.battery < 0 || data.battery > 100)) {
      throw new Error('Niveau de batterie invalide (0-100)');
    }
  }

  /**
   * Validation des messages d'alerte
   */
  validateAlertMessage(data) {
    const required = ['deviceId', 'alertType', 'severity', 'timestamp'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Champ requis manquant: ${field}`);
      }
    }
    
    const validSeverities = ['CRITICAL', 'WARNING', 'INFO'];
    if (!validSeverities.includes(data.severity)) {
      throw new Error(`Sévérité invalide: ${data.severity}`);
    }
  }

  /**
   * Validation des messages de statut
   */
  validateStatusMessage(data) {
    if (!data.deviceId) {
      throw new Error('Device ID requis');
    }
    
    if (!data.status) {
      throw new Error('Status requis');
    }
  }

  /**
   * Traitement des messages
   */
  processMessage(topic, data) {
    // Notifier les subscribers du topic
    const subscribers = this.subscribers.get(topic) || [];
    subscribers.forEach(callback => {
      try {
        callback(data, topic);
      } catch (error) {
        mqttLogger.messageError(topic, JSON.stringify(data), error);
      }
    });
  }

  /**
   * Publication de message avec gestion d'erreurs
   */
  async publish(topic, message, options = {}) {
    if (!this.isConnected) {
      // Ajouter à la file d'attente
      this.messageQueue.push({ topic, message, options, timestamp: Date.now() });
      throw AppError.mqttConnection('Non connecté - message mis en file d\'attente');
    }
    
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      return new Promise((resolve, reject) => {
        this.client.publish(topic, messageStr, options, (error) => {
          if (error) {
            mqttLogger.messageError(topic, messageStr, error);
            reject(AppError.mqttConnection(`Erreur de publication: ${error.message}`));
          } else {
            resolve(true);
          }
        });
      });
      
    } catch (error) {
      throw AppError.mqttConnection(`Erreur de publication: ${error.message}`);
    }
  }

  /**
   * Abonnement à un topic avec gestion d'erreurs
   */
  async subscribe(topic, callback) {
    if (!this.isConnected) {
      throw AppError.mqttConnection('Non connecté - impossible de s\'abonner');
    }
    
    try {
      await new Promise((resolve, reject) => {
        this.client.subscribe(topic, (error) => {
          if (error) {
            reject(AppError.mqttConnection(`Erreur d'abonnement: ${error.message}`));
          } else {
            resolve(true);
          }
        });
      });
      
      // Ajouter le callback aux subscribers
      if (!this.subscribers.has(topic)) {
        this.subscribers.set(topic, []);
      }
      this.subscribers.get(topic).push(callback);
      
    } catch (error) {
      throw AppError.mqttConnection(`Erreur d'abonnement: ${error.message}`);
    }
  }

  /**
   * Resubscribe à tous les topics après reconnexion
   */
  async resubscribeAll() {
    const topics = Array.from(this.subscribers.keys());
    
    for (const topic of topics) {
      try {
        await new Promise((resolve, reject) => {
          this.client.subscribe(topic, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(true);
            }
          });
        });
      } catch (error) {
        mqttLogger.messageError(topic, '', error);
      }
    }
  }

  /**
   * Traitement de la file d'attente des messages
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const { topic, message, options, timestamp } = this.messageQueue.shift();
      
      // Ignorer les messages trop vieux (plus de 5 minutes)
      if (Date.now() - timestamp > 300000) {
        continue;
      }
      
      // Tenter de publier le message
      this.publish(topic, message, options).catch(error => {
        // Remettre en file si erreur
        this.messageQueue.unshift({ topic, message, options, timestamp });
      });
    }
  }

  /**
   * Gestion du nombre maximum de tentatives de reconnexion
   */
  handleMaxReconnectAttemptsReached() {
    const error = AppError.mqttConnection(
      `Nombre maximum de tentatives de reconnexion atteint (${this.maxReconnectAttempts})`
    );
    
    this.notifyCallbacks('maxReconnectAttemptsReached', error);
    
    // Arrêter les tentatives de reconnexion
    if (this.client) {
      this.client.end();
    }
  }

  /**
   * Ajout d'un callback d'erreur
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notification des callbacks d'erreur
   */
  notifyCallbacks(event, data = null) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Erreur dans le callback MQTT:', error);
      }
    });
  }

  /**
   * Déconnexion propre
   */
  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, {}, () => {
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  /**
   * Statut de connexion
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      brokerUrl: this.brokerUrl,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.messageQueue.length,
      subscribedTopics: Array.from(this.subscribers.keys())
    };
  }
}

export default MQTTErrorHandler;
