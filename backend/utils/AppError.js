/**
 * Smart Shepherd - Custom Error Class
 * Gestion unifiée des erreurs avec codes HTTP standardisés
 */

class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Crée une erreur de validation
   */
  static validation(message, details = null) {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  /**
   * Crée une erreur d'authentification
   */
  static unauthorized(message = 'Non autorisé') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Crée une erreur de permissions
   */
  static forbidden(message = 'Accès interdit') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  /**
   * Crée une erreur de ressource non trouvée
   */
  static notFound(resource = 'Ressource') {
    return new AppError(`${resource} non trouvée`, 404, 'NOT_FOUND');
  }

  /**
   * Crée une erreur de conflit
   */
  static conflict(message = 'Conflit de données') {
    return new AppError(message, 409, 'CONFLICT');
  }

  /**
   * Crée une erreur de timeout
   */
  static timeout(message = 'Timeout de la requête') {
    return new AppError(message, 408, 'TIMEOUT');
  }

  /**
   * Crée une erreur de service indisponible
   */
  static serviceUnavailable(message = 'Service temporairement indisponible') {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Crée une erreur de base de données
   */
  static database(message = 'Erreur de base de données') {
    return new AppError(message, 500, 'DATABASE_ERROR');
  }

  /**
   * Crée une erreur de service externe (MQTT, API tiers)
   */
  static externalService(service, message = null) {
    const msg = message || `Erreur du service externe: ${service}`;
    return new AppError(msg, 502, 'EXTERNAL_SERVICE_ERROR', { service });
  }

  /**
   * Crée une erreur de connexion MQTT
   */
  static mqttConnection(message = 'Erreur de connexion MQTT') {
    return new AppError(message, 503, 'MQTT_CONNECTION_ERROR');
  }

  /**
   * Crée une erreur de WebSocket
   */
  static websocket(message = 'Erreur de connexion WebSocket') {
    return new AppError(message, 503, 'WEBSOCKET_ERROR');
  }

  /**
   * Convertit l'erreur en format JSON standardisé
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.errorCode || this.getDefaultErrorCode(),
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details }),
        ...(process.env.NODE_ENV === 'development' && { 
          stack: this.stack,
          name: this.name 
        })
      }
    };
  }

  /**
   * Détermine le code d'erreur par défaut selon le status code
   */
  getDefaultErrorCode() {
    const errorCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      408: 'TIMEOUT',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    };
    
    return errorCodes[this.statusCode] || 'UNKNOWN_ERROR';
  }
}

export default AppError;
