# Smart Shepherd Admin Dashboard - Documentation Complète

## Vue d'Ensemble du Projet

**Smart Shepherd Admin Dashboard** est une application web complète de gestion et de surveillance IoT pour l'élevage de moutons. Le système permet de suivre en temps réel la position, la santé et le comportement des animaux grâce à des colliers connectés, des capteurs biométriques et une interface de cartographie interactive.

---

## Architecture Technique

### Frontend (React + TypeScript)
- **Framework**: React 18 avec TypeScript
- **Bundler**: Vite
- **Styling**: TailwindCSS avec support Dark Mode
- **Cartographie**: Leaflet + React-Leaflet
- **Gestion d'état**: Zustand
- **Communication**: MQTT + WebSocket (Socket.IO)
- **Animations**: Framer Motion
- **Graphiques**: Chart.js + React-ChartJS-2
- **Virtualisation**: React-Window pour les grandes listes

### Backend (Node.js + Express)
- **Runtime**: Node.js 18+ avec ES Modules
- **Framework**: Express.js
- **Base de données**: MongoDB + Mongoose ODM
- **Authentification**: JWT Refresh Token avec rotation
- **Communication IoT**: MQTT (Mosquitto) avec gestion d'erreurs
- **Temps réel**: Socket.IO avec heartbeat
- **Sécurité**: Helmet, CORS, Rate Limiting
- **Logging**: Winston avec monitoring avancé
- **Validation**: Joi
- **Gestion Erreurs**: Middleware global avec AppError

### Infrastructure IoT
- **Protocole**: MQTT pour la communication device-to-server
- **Capteurs**: GPS, température, fréquence cardiaque, niveau de batterie
- **Géofencing**: Polygones virtuels avec alertes de violation
- **Notifications**: Multi-canaux (WebSocket, Email, SMS)
- **Simulation**: Comportement animal réaliste avec facteurs environnementaux

---

## Fonctionnalités Principales

### 1. Cartographie en Temps Réel
- **Localisation Utilisateur**: Position GPS exacte avec cercle de précision
- **Suivi des Animaux**: Marqueurs animés avec historique de déplacement
- **Géofencing**: Zones virtuelles personnalisables avec alertes
- **Couches de Carte**: Plusieurs fournisseurs (Street, Satellite, Dark, Terrain)
- **Clustering**: Groupement automatique des marqueurs pour performance

### 2. Gestion des Animaux
- **Registre**: Informations complètes (race, âge, poids, santé)
- **Historique Médical**: Vaccinations, traitements, observations
- **Statistiques**: Tableaux de bord avec indicateurs de santé
- **Recherche**: Filtrage avancé par critères multiples

### 3. Simulation Avancée
- **Comportement Réaliste**: Patterns de pâturage, repos, socialisation
- **Facteurs Environnementaux**: Météo, température, humidité, cycles jour/nuit
- **Métriques de Santé**: Fréquence cardiaque, température, hydratation
- **Panneau de Contrôle**: Interface complète de gestion simulation
- **Batterie**: Drain réaliste selon activité et état

### 4. Télémétrie IoT
- **Données en Temps Réel**: Fréquence cardiaque, température, activité
- **Alertes Automatiques**: Seuils personnalisables
- **Historique**: Graphiques temporels et tendances
- **État des Appareils**: Niveau de batterie, qualité du signal

### 5. Système de Notifications
- **Alertes Santé**: Anomalies biométriques
- **Alertes Géolocalisation**: Sortie de zone, animaux perdus
- **Notifications Système**: Maintenance, pannes
- **Priorisation**: Niveaux d'urgence (Low, Medium, High, Critical)

### 6. Gestion des Utilisateurs
- **Rôles et Permissions**: Admin, Operator, Viewer
- **Authentification Sécurisée**: JWT Refresh Token avec rotation
- **Profils Personnalisés**: Préférences et notifications
- **Sessions Multiples**: Gestion et révocation

---

## Structure des Données

### Modèle Animal (Sheep)
```typescript
interface Sheep {
  _id: ObjectId;
  sheepId: string;           // Identifiant unique
  breed: string;            // Race (Merino, Suffolk, etc.)
  age: number;              // Âge en années
  weight: number;           // Poids en kg
  gender: 'male' | 'female'; // Genre
  healthStatus: 'Good' | 'Warning' | 'Critical';
  location: {               // Coordonnées GPS
    lat: number;
    lng: number;
    accuracy?: number;
  };
  deviceId: string;        // ID du collier connecté
  medicalHistory: MedicalRecord[];
  heartRate?: number;      // BPM
  temperature?: number;    // °C
  battery: number;         // %
  heading?: number;         // Direction en degrés
  speed?: number;          // km/h
  lastUpdate: string;
  isActive: boolean;
}
```

### Données Télémétrie
```typescript
interface TelemetryData {
  deviceId: string;
  sheepId: string;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  battery: number;         // % (0-100)
  temperature: number;     // °C (38.5-40.5 normal)
  heartRate: number;       // BPM (60-120 normal)
  activity: 'idle' | 'walking' | 'running' | 'grazing' | 'resting';
  signalStrength: number;  // dBm (-120 to 0)
  steps?: number;
}
```

### Géofence
```typescript
interface Geofence {
  _id: ObjectId;
  name: string;
  description: string;
  coords: [number, number][]; // Coordonnées du polygone
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: ObjectId;
}
```

---

## Flux de Communication

### 1. Architecture MQTT
```
[Capteurs IoT] -> [Broker MQTT] -> [Backend Node.js] -> [Frontend React]
                     ^                    |
                     |                    v
                 [WebSocket] <---- [Socket.IO Server]
```

### Topics MQTT
- `shepherd/+/telemetry` - Données biométriques
- `shepherd/+/location` - Mises à jour GPS
- `shepherd/+/alerts` - Alertes device
- `shepherd/+/heartbeat` - Heartbeat device
- `shepherd/+/commands/+` - Commandes vers devices

### 2. WebSocket Events
- `sheep:added` - Nouvel animal enregistré
- `sheep:location` - Mise à jour position
- `telemetry:realtime` - Données télémétrie
- `geofence:violation` - Violation de zone
- `notification:new` - Nouvelle notification

---

## Sécurité Avancée

### 1. Authentification JWT Refresh Token
- **Access Token**: 15 minutes avec rotation automatique
- **Refresh Token**: 30 jours stocké en cookie httpOnly
- **Rotation**: Nouveau refresh token à chaque utilisation
- **Blacklist**: Redis pour tokens révoqués
- **Logout**: Révocation immédiate de tous les tokens

### 2. Sécurité API
- **Rate Limiting**: 100 requêtes/15min/IP
- **CORS**: Origines autorisées
- **Helmet**: Headers HTTP sécurisés
- **Validation**: Joi pour toutes les entrées
- **Error Handling**: Format JSON unifié

### 3. Protection des Données
- **Hashing**: bcryptjs pour mots de passe
- **HTTPS**: TLS 1.3 en production
- **Sanitization**: Protection XSS/CSRF
- **Logging**: Traçabilité des actions

---

## Performance

### 1. Optimisation Frontend
- **Code Splitting**: Lazy loading par route
- **Virtualisation**: React-Window pour listes
- **Memoization**: React.memo et useMemo
- **Web Workers**: Calculs hors thread principal
- **Cache**: Service Worker PWA

### 2. Optimisation Backend
- **Indexation**: MongoDB indexes optimisés
- **Pagination**: Limit/offset pour grandes données
- **Compression**: Gzip pour réponses API
- **Connection Pooling**: MongoDB optimisé
- **Redis**: Cache et blacklist

### 3. Performance Carte
- **Marker Clustering**: Groupement spatial
- **Canvas Rendering**: Préférence canvas vs DOM
- **Tile Caching**: Cache des tuiles de carte
- **Viewport Culling**: Rendu uniquement visible

---

## CI/CD Pipeline

### 1. GitHub Actions Workflow
```yaml
# Jobs:
- security-scan: npm audit + Snyk
- ci: lint + tests + coverage
- build: Docker multi-stage
- deploy: DigitalOcean/AWS
- staging: Déploiement automatique develop
```

### 2. Docker Multi-Stage
```dockerfile
# Frontend: Node build + Nginx production
# Backend: Node build + Alpine runtime
# Sécurité: Non-root user, health checks
# Optimisation: Cache layers, multi-arch
```

### 3. Déploiement
- **Frontend**: GitHub Container Registry
- **Backend**: ECS/DigitalOcean App Platform
- **Database**: MongoDB Atlas managé
- **Monitoring**: Prometheus + Grafana

---

## Gestion des Erreurs

### 1. AppError Class
```typescript
class AppError extends Error {
  constructor(message, statusCode, errorCode, details) {
    // Format JSON unifié
    // Codes HTTP standardisés
    // Support développement/production
  }
}
```

### 2. Middleware Global
- **Capture** toutes les erreurs non gérées
- **Validation** erreurs MongoDB (duplicate, cast, validation)
- **Logging** structuré avec métriques
- **Monitoring** avec seuils d'alerte

### 3. Services Spécialisés
- **MQTT**: Reconnexion automatique, file d'attente
- **WebSocket**: Heartbeat, timeout, authentification
- **Database**: Connection pooling, retry logic

---

## API REST Documentation

### OpenAPI 3.0 Spécification
```yaml
# Fichier: backend/openapi.yaml
# Endpoints complets avec:
- Authentification (login, register, refresh, logout)
- Animaux CRUD complet
- Télémétrie temps réel
- Géofences management
- Notifications système
- Utilisateurs admin
```

### Endpoints Clés
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Déconnexion
- `GET /api/sheep` - Liste animaux
- `POST /api/telemetry` - Données IoT
- `GET /api/geofences` - Zones géographiques

---

## Simulation Avancée

### 1. Comportement Animal Réaliste
```typescript
interface AnimalBehavior {
  grazingPattern: 'active' | 'resting' | 'seeking_shelter' | 'socializing';
  stressLevel: number;
  energyLevel: number;
  preferredTerrain: 'open' | 'shaded' | 'near_water' | 'near_shelter';
}
```

### 2. Facteurs Environnementaux
```typescript
interface EnvironmentState {
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  weather: 'sunny' | 'cloudy' | 'rainy' | 'windy';
  temperature: number;
  humidity: number;
}
```

### 3. Panneau de Contrôle
- **Démarrage/Arrêt** simulation
- **Paramètres**: Nombre d'animaux, intervalle
- **Monitoring**: État environnement, comportement
- **Sélection**: Détails animal individuel

---

## Développement Local

### 1. Docker Compose Complet
```yaml
# Services:
- mongodb: Base de données
- mosquitto: Broker MQTT
- redis: Cache et blacklist
- backend: API Node.js
- frontend: Application React
- nginx: Reverse proxy
- prometheus: Monitoring
- grafana: Dashboards
```

### 2. Installation
```bash
# Cloner le projet
git clone https://github.com/smart-shepherd/smart-shepherd.git
cd smart-shepherd

# Démarrer tous les services
docker-compose up -d

# Accéder aux applications
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Grafana: http://localhost:3001
```

---

## Tests

### 1. Tests Unitaires
```typescript
// Jest + React Testing Library
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import MapComponent from './MapComponent';

test('renders map with markers', () => {
  render(
    <Provider store={store}>
      <MapComponent animals={mockAnimals} />
    </Provider>
  );
  expect(screen.getByTestId('map-container')).toBeInTheDocument();
});
```

### 2. Tests d'Intégration
```typescript
// Supertest pour API
import request from 'supertest';
import app from './server';

test('POST /api/auth/refresh', async () => {
  const response = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', 'refreshToken=...')
    .expect(200);
  
  expect(response.body.accessToken).toBeDefined();
});
```

### 3. Tests E2E
```typescript
// Playwright
import { test, expect } from '@playwright/test';

test('simulation workflow', async ({ page }) => {
  await page.goto('/dashboard-enhanced');
  await page.waitForSelector('[data-testid="simulation-control"]');
  
  // Démarrer simulation
  await page.click('[data-testid="sim-start"]');
  await expect(page.locator('[data-testid="sim-status"]')).toContainText('Running');
  
  // Vérifier comportement
  await page.click('[data-testid="animal-selector"]');
  await expect(page.locator('[data-testid="animal-behavior"]')).toBeVisible();
});
```

---

## Monitoring & Logging

### 1. Logs Structurés
```typescript
// Winston logging avec monitoring
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### 2. Métriques
- **Performance**: Temps de réponse, throughput
- **Business**: Animaux actifs, alertes générées
- **Système**: CPU, mémoire, disque
- **IoT**: Messages MQTT, connexion devices
- **Sécurité**: Tentatives d'authentification, erreurs

### 3. Alerting
- **Système**: Erreurs critiques, pannes
- **Performance**: Latence > 1s
- **Business**: Plus de 10% d'animaux hors zone
- **Sécurité**: Trop d'échecs d'authentification

---

## Maintenance

### 1. Mises à Jour
- **Dépendances**: npm audit fix mensuel
- **Sécurité**: Patchs critiques immédiats
- **Fonctionnalités**: Releases trimestrielles
- **Docker**: Images mises à jour automatiquement

### 2. Sauvegardes
- **Base de données**: MongoDB dumps quotidiens
- **Configuration**: Git versioning
- **Logs**: Rotation 30 jours
- **Metrics**: Export mensuel

### 3. Monitoring
- **Uptime**: Ping toutes les minutes
- **Performance**: Tests de charge hebdomadaires
- **Sécurité**: Scans de vulnérabilité mensuels
- **Health Checks**: Automatisés avec alertes

---

## Extensions Futures

### 1. IA & Machine Learning
- **Prédiction Santé**: Modèles d'apprentissage sur données historiques
- **Comportement**: Analyse de patterns de mouvement
- **Optimisation**: Suggestions alimentaires et de gestion
- **Anomalies**: Détection automatique de comportements anormaux

### 2. Mobile
- **Application Native**: React Native pour terrain
- **Notifications Push**: Alertes instantanées
- **Mode Hors Ligne**: Synchronisation différée
- **GPS Tracking**: Mode haute précision

### 3. Intégrations
- **Météo**: Prévisions pour planification
- **Marché**: Prix du bétail en temps réel
- **Vétérinaires**: Téléconsultation intégrée
- **Capteurs Avancés**: Caméras, thermiques, poids automatique

---

## Conclusion

Smart Shepherd Admin Dashboard représente une solution IoT complète et moderne pour la gestion d'élevage. L'architecture microservices, la communication en temps réel, la simulation avancée et l'interface utilisateur intuitive en font un outil puissant pour les éleveurs modernes.

Le projet démontre l'utilisation experte de technologies web contemporaines avec:
- **Sécurité** de niveau entreprise (JWT refresh, monitoring)
- **Performance** optimisée (Docker multi-stage, cache Redis)
- **Fiabilité** (gestion d'erreurs, reconnexion automatique)
- **Scalabilité** (CI/CD complet, déploiement multi-cloud)
- **Innovation** (simulation réaliste, IA prédictive)

L'intégration complète de toutes ces fonctionnalités fait de Smart Shepherd une référence dans le domaine de l'IoT agricole.
