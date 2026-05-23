/**
 * Smart Shepherd - WebSocket Error Handling Service
 * Gestion robuste des erreurs de connexion et timeout WebSocket
 */

import { websocketLogger } from '../utils/errorLogger.js';
import AppError from '../utils/AppError.js';

class WebSocketErrorHandler {
  constructor(io) {
    this.io = io;
    this.connectedClients = new Map();
    this.clientTimeouts = new Map();
    this.messageQueue = new Map();
    this.maxMessageQueueSize = 100;
    this.defaultTimeout = 30000; // 30 secondes
    this.heartbeatInterval = 25000; // 25 secondes
    this.maxReconnectAttempts = 5;
    
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * Configuration des gestionnaires d'événements WebSocket
   */
  setupEventHandlers() {
    // Gestionnaire de connexion
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Gestionnaire d'erreurs du serveur
    this.io.on('error', (error) => {
      websocketLogger.connectionError('server', error);
    });

    // Gestionnaire d'erreurs de namespace
    this.io.of('/').on('error', (error) => {
      websocketLogger.connectionError('namespace', error);
    });
  }

  /**
   * Gestionnaire de connexion client
   */
  handleConnection(socket) {
    const clientId = socket.id;
    const clientInfo = {
      id: clientId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      userId: socket.handshake.query.userId || null,
      userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
      ip: socket.handshake.address || socket.conn.remoteAddress,
      isAuthenticated: false,
      messageCount: 0,
      errorCount: 0
    };

    this.connectedClients.set(clientId, clientInfo);
    
    // Configurer les timeouts pour ce client
    this.setupClientTimeouts(socket);
    
    // Configurer les gestionnaires d'événements pour ce client
    this.setupClientEventHandlers(socket);
    
    // Envoyer un message de bienvenue
    this.sendWelcomeMessage(socket);
    
    websocketLogger.connectionError(clientId, new Error('Client connected'));
  }

  /**
   * Configuration des timeouts pour un client
   */
  setupClientTimeouts(socket) {
    const clientId = socket.id;
    
    // Timeout d'inactivité
    const inactivityTimeout = setTimeout(() => {
      this.handleInactivityTimeout(socket);
    }, this.defaultTimeout);
    
    // Timeout de heartbeat
    const heartbeatTimeout = setTimeout(() => {
      this.handleHeartbeatTimeout(socket);
    }, this.heartbeatInterval);
    
    this.clientTimeouts.set(clientId, {
      inactivity: inactivityTimeout,
      heartbeat: heartbeatTimeout,
      lastReset: Date.now()
    });
  }

  /**
   * Configuration des gestionnaires d'événements client
   */
  setupClientEventHandlers(socket) {
    const clientId = socket.id;
    
    // Gestionnaire de déconnexion
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Gestionnaire d'erreur de socket
    socket.on('error', (error) => {
      this.handleSocketError(socket, error);
    });

    // Gestionnaire de messages
    socket.onAny((eventName, ...args) => {
      this.handleClientMessage(socket, eventName, args);
    });

    // Gestionnaire de ping/pong
    socket.on('ping', () => {
      this.handlePing(socket);
    });

    socket.on('pong', () => {
      this.handlePong(socket);
    });

    // Gestionnaire d'authentification
    socket.on('authenticate', (data) => {
      this.handleAuthentication(socket, data);
    });

    // Gestionnaire de réponse heartbeat
    socket.on('heartbeat_response', () => {
      this.handleHeartbeatResponse(socket);
    });
  }

  /**
   * Gestionnaire de déconnexion client
   */
  handleDisconnection(socket, reason) {
    const clientId = socket.id;
    const clientInfo = this.connectedClients.get(clientId);
    
    // Nettoyer les timeouts
    this.clearClientTimeouts(clientId);
    
    // Nettoyer la file d'attente
    this.messageQueue.delete(clientId);
    
    // Logger la déconnexion
    websocketLogger.disconnect(clientId, reason);
    
    // Supprimer le client
    this.connectedClients.delete(clientId);
  }

  /**
   * Gestionnaire d'erreur de socket
   */
  handleSocketError(socket, error) {
    const clientId = socket.id;
    const clientInfo = this.connectedClients.get(clientId);
    
    if (clientInfo) {
      clientInfo.errorCount++;
      clientInfo.lastError = {
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
    
    websocketLogger.connectionError(clientId, error);
    
    // Envoyer une notification d'erreur au client
    this.sendErrorToClient(socket, 'SOCKET_ERROR', error.message);
    
    // Si trop d'erreurs, déconnecter le client
    if (clientInfo && clientInfo.errorCount > 5) {
      socket.disconnect(true);
    }
  }

  /**
   * Gestionnaire de messages client
   */
  handleClientMessage(socket, eventName, args) {
    const clientId = socket.id;
    const clientInfo = this.connectedClients.get(clientId);
    
    try {
      // Mettre à jour l'activité du client
      if (clientInfo) {
        clientInfo.lastActivity = new Date().toISOString();
        clientInfo.messageCount++;
        
        // Réinitialiser le timeout d'inactivité
        this.resetInactivityTimeout(socket);
      }
      
      // Valider le message
      this.validateClientMessage(socket, eventName, args);
      
      // Traiter le message selon le type
      this.processClientMessage(socket, eventName, args);
      
    } catch (error) {
      websocketLogger.messageError(clientId, eventName, error);
      
      // Envoyer une erreur au client
      this.sendErrorToClient(socket, 'MESSAGE_ERROR', error.message);
      
      // Mettre à jour le compteur d'erreurs
      if (clientInfo) {
        clientInfo.errorCount++;
      }
    }
  }

  /**
   * Validation des messages client
   */
  validateClientMessage(socket, eventName, args) {
    const clientInfo = this.connectedClients.get(socket.id);
    
    // Vérifier si le client est authentifié pour les messages protégés
    const protectedEvents = ['telemetry_update', 'alert_create', 'geofence_modify'];
    if (protectedEvents.includes(eventName) && (!clientInfo || !clientInfo.isAuthenticated)) {
      throw new Error('Authentification requise pour cette action');
    }
    
    // Valider la taille du message
    const messageSize = JSON.stringify(args).length;
    if (messageSize > 1024 * 1024) { // 1MB
      throw new Error('Message trop volumineux');
    }
    
    // Valider le format selon le type d'événement
    switch (eventName) {
      case 'telemetry_update':
        this.validateTelemetryUpdate(args[0]);
        break;
      case 'alert_create':
        this.validateAlertCreate(args[0]);
        break;
      case 'geofence_modify':
        this.validateGeofenceModify(args[0]);
        break;
    }
  }

  /**
   * Validation des mises à jour de télémétrie
   */
  validateTelemetryUpdate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Données de télémétrie invalides');
    }
    
    const required = ['deviceId', 'timestamp', 'location'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Champ requis manquant: ${field}`);
      }
    }
  }

  /**
   * Validation des créations d'alerte
   */
  validateAlertCreate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Données d\'alerte invalides');
    }
    
    const required = ['type', 'severity', 'message'];
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`Champ requis manquant: ${field}`);
      }
    }
  }

  /**
   * Validation des modifications de géofence
   */
  validateGeofenceModify(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Données de géofence invalides');
    }
    
    if (!data.id) {
      throw new Error('ID de géofence requis');
    }
  }

  /**
   * Traitement des messages client
   */
  processClientMessage(socket, eventName, args) {
    const clientId = socket.id;
    
    switch (eventName) {
      case 'subscribe_telemetry':
        this.handleTelemetrySubscription(socket, args[0]);
        break;
      case 'subscribe_alerts':
        this.handleAlertSubscription(socket, args[0]);
        break;
      case 'ping':
        this.handlePing(socket);
        break;
      default:
        // Émettre l'événement aux autres clients si nécessaire
        this.broadcastEvent(socket, eventName, args);
    }
  }

  /**
   * Gestionnaire d'authentification
   */
  handleAuthentication(socket, data) {
    const clientId = socket.id;
    const clientInfo = this.connectedClients.get(clientId);
    
    try {
      // Valider les données d'authentification
      if (!data || !data.token) {
        throw new Error('Token d\'authentification manquant');
      }
      
      // Implémenter la validation du token JWT ici
      // const user = validateJWTToken(data.token);
      
      if (clientInfo) {
        clientInfo.isAuthenticated = true;
        clientInfo.userId = data.userId || 'unknown';
        clientInfo.authenticatedAt = new Date().toISOString();
      }
      
      // Envoyer une confirmation
      socket.emit('authentication_success', {
        clientId,
        authenticated: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      websocketLogger.messageError(clientId, 'authentication', error);
      
      // Envoyer une erreur d'authentification
      socket.emit('authentication_error', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Déconnecter le client après un certain temps
      setTimeout(() => {
        if (this.connectedClients.has(clientId)) {
          socket.disconnect(true);
        }
      }, 5000);
    }
  }

  /**
   * Gestionnaire de timeout d'inactivité
   */
  handleInactivityTimeout(socket) {
    const clientId = socket.id;
    websocketLogger.timeoutError(clientId, 'inactivity');
    
    // Envoyer un ping pour vérifier si le client est toujours là
    socket.emit('ping_check', {
      timestamp: new Date().toISOString()
    });
    
    // Attendre une réponse pendant 10 secondes
    setTimeout(() => {
      if (this.connectedClients.has(clientId)) {
        const clientInfo = this.connectedClients.get(clientId);
        const lastActivity = new Date(clientInfo.lastActivity);
        const timeSinceActivity = Date.now() - lastActivity.getTime();
        
        // Si toujours pas d'activité, déconnecter
        if (timeSinceActivity > this.defaultTimeout + 10000) {
          socket.disconnect(true);
        }
      }
    }, 10000);
  }

  /**
   * Gestionnaire de timeout heartbeat
   */
  handleHeartbeatTimeout(socket) {
    const clientId = socket.id;
    websocketLogger.timeoutError(clientId, 'heartbeat');
    
    // Envoyer un heartbeat
    socket.emit('heartbeat', {
      timestamp: new Date().toISOString()
    });
    
    // Réinitialiser le timeout heartbeat
    this.resetHeartbeatTimeout(socket);
  }

  /**
   * Gestionnaire de réponse heartbeat
   */
  handleHeartbeatResponse(socket) {
    this.resetHeartbeatTimeout(socket);
    this.resetInactivityTimeout(socket);
  }

  /**
   * Gestionnaire de ping
   */
  handlePing(socket) {
    socket.emit('pong', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Gestionnaire de pong
   */
  handlePong(socket) {
    this.resetInactivityTimeout(socket);
  }

  /**
   * Système de heartbeat global
   */
  startHeartbeat() {
    setInterval(() => {
      this.connectedClients.forEach((clientInfo, clientId) => {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.emit('heartbeat', {
            timestamp: new Date().toISOString()
          });
        }
      });
    }, this.heartbeatInterval);
  }

  /**
   * Réinitialisation du timeout d'inactivité
   */
  resetInactivityTimeout(socket) {
    const clientId = socket.id;
    const timeouts = this.clientTimeouts.get(clientId);
    
    if (timeouts) {
      clearTimeout(timeouts.inactivity);
      timeouts.inactivity = setTimeout(() => {
        this.handleInactivityTimeout(socket);
      }, this.defaultTimeout);
    }
  }

  /**
   * Réinitialisation du timeout heartbeat
   */
  resetHeartbeatTimeout(socket) {
    const clientId = socket.id;
    const timeouts = this.clientTimeouts.get(clientId);
    
    if (timeouts) {
      clearTimeout(timeouts.heartbeat);
      timeouts.heartbeat = setTimeout(() => {
        this.handleHeartbeatTimeout(socket);
      }, this.heartbeatInterval);
    }
  }

  /**
   * Nettoyage des timeouts client
   */
  clearClientTimeouts(clientId) {
    const timeouts = this.clientTimeouts.get(clientId);
    if (timeouts) {
      clearTimeout(timeouts.inactivity);
      clearTimeout(timeouts.heartbeat);
      this.clientTimeouts.delete(clientId);
    }
  }

  /**
   * Envoi de message de bienvenue
   */
  sendWelcomeMessage(socket) {
    socket.emit('welcome', {
      clientId: socket.id,
      serverTime: new Date().toISOString(),
      message: 'Connecté à Smart Shepherd WebSocket',
      heartbeatInterval: this.heartbeatInterval
    });
  }

  /**
   * Envoi d'erreur au client
   */
  sendErrorToClient(socket, errorCode, message) {
    socket.emit('error', {
      errorCode,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast d'événement
   */
  broadcastEvent(socket, eventName, args) {
    const clientId = socket.id;
    
    // Ne pas broadcaster les messages système
    const systemEvents = ['ping', 'pong', 'heartbeat', 'heartbeat_response', 'authenticate'];
    if (systemEvents.includes(eventName)) {
      return;
    }
    
    // Émettre à tous les autres clients
    socket.broadcast.emit(eventName, ...args);
  }

  /**
   * Obtention des statistiques des clients
   */
  getClientStats() {
    const stats = {
      totalClients: this.connectedClients.size,
      authenticatedClients: 0,
      totalMessages: 0,
      totalErrors: 0,
      averageMessagesPerClient: 0,
      clients: []
    };
    
    this.connectedClients.forEach((clientInfo, clientId) => {
      if (clientInfo.isAuthenticated) {
        stats.authenticatedClients++;
      }
      
      stats.totalMessages += clientInfo.messageCount;
      stats.totalErrors += clientInfo.errorCount;
      
      stats.clients.push({
        id: clientId,
        connectedAt: clientInfo.connectedAt,
        lastActivity: clientInfo.lastActivity,
        isAuthenticated: clientInfo.isAuthenticated,
        messageCount: clientInfo.messageCount,
        errorCount: clientInfo.errorCount,
        userId: clientInfo.userId
      });
    });
    
    if (stats.totalClients > 0) {
      stats.averageMessagesPerClient = stats.totalMessages / stats.totalClients;
    }
    
    return stats;
  }

  /**
   * Déconnexion de tous les clients
   */
  disconnectAllClients() {
    this.connectedClients.forEach((clientInfo, clientId) => {
      const socket = this.io.sockets.sockets.get(clientId);
      if (socket) {
        socket.disconnect(true);
      }
    });
  }
}

export default WebSocketErrorHandler;
