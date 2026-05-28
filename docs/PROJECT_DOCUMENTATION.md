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
- **Authentification**: JWT avec bcryptjs
- **Communication IoT**: MQTT (Mosquitto)
- **Temps réel**: Socket.IO
- **Sécurité**: Helmet, CORS, Rate Limiting
- **Logging**: Winston
- **Validation**: Joi

### Infrastructure IoT
- **Protocole**: MQTT pour la communication device-to-server
- **Capteurs**: GPS, température, fréquence cardiaque, niveau de batterie
- **Géofencing**: Polygones virtuels avec alertes de violation
- **Notifications**: Multi-canaux (WebSocket, Email, SMS)

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

### 3. Télémétrie IoT
- **Données en Temps Réel**: Fréquence cardiaque, température, activité
- **Alertes Automatiques**: Seuils personnalisables
- **Historique**: Graphiques temporels et tendances
- **État des Appareils**: Niveau de batterie, qualité du signal

### 4. Système de Notifications
- **Alertes Santé**: Anomalies biométriques
- **Alertes Géolocalisation**: Sortie de zone, animaux perdus
- **Notifications Système**: Maintenance, pannes
- **Priorisation**: Niveaux d'urgence (Low, Medium, High, Critical)

### 5. Gestion des Utilisateurs
- **Rôles et Permissions**: Admin, Operator, Viewer
- **Authentification Sécurisée**: JWT tokens
- **Profils Personnalisés**: Préférences et notifications

---

## Structure des Données

### Modèle Animal (Sheep)
```typescript
interface Sheep {
  sheepId: string;           // Identifiant unique
  breed: string;            // Race (Merino, Suffolk, etc.)
  age: number;              // Âge en années
  weight: number;           // Poids en kg
  gender: 'male' | 'female'; // Genre
  healthStatus: string;     // État de santé
  location: {               // Coordonnées GPS
    type: 'Point';
    coordinates: [number, number];
  };
  deviceId: string;        // ID du collier connecté
  medicalHistory: Array;    // Historique médical
}
```

### Données Télémétrie
```typescript
interface TelemetryData {
  deviceId: string;
  sheepId: string;
  timestamp: Date;
  data: {
    heartRate: number;      // BPM (60-120 normal)
    temperature: number;    // °C (38.5-40.5 normal)
    activity: number;      // Score d'activité (0-100)
    batteryLevel: number;   // % (0-100)
    signalStrength: number; // dBm (-120 to 0)
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  };
}
```

### Géofence
```typescript
interface Geofence {
  id: string;
  name: string;
  description: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  isActive: boolean;
  alertThreshold: number;
  notificationChannels: string[];
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

## Sécurité

### 1. Authentification
- **JWT Tokens**: Signature HMAC-SHA256
- **Expiration**: 7 jours configurable
- **Refresh**: Renouvellement automatique
- **Rôles**: Contrôle d'accès granulaire

### 2. Sécurité API
- **Rate Limiting**: 100 requêtes/15min/IP
- **CORS**: Origines autorisées
- **Helmet**: Headers HTTP sécurisés
- **Validation**: Joi pour toutes les entrées

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

### 3. Performance Carte
- **Marker Clustering**: Groupement spatial
- **Canvas Rendering**: Préférence canvas vs DOM
- **Tile Caching**: Cache des tuiles de carte
- **Viewport Culling**: Rendu uniquement visible

---

## Déploiement

### 1. Environnement Développement
```bash
# Frontend
npm run dev          # Vite dev server (port 5173)

# Backend
cd backend
npm run dev          # Nodemon (port 5000)

# MQTT Broker
mosquitto -c mosquitto.conf  # Port 1883

# MongoDB
mongod --dbpath /data/db     # Port 27017
```

### 2. Production Docker
```dockerfile
# Frontend Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### 3. Infrastructure Cloud
- **Frontend**: Vercel/Netlify (CDN)
- **Backend**: AWS ECS/DigitalOcean
- **Base de données**: MongoDB Atlas
- **MQTT**: AWS IoT Core / CloudMQTT
- **Monitoring**: DataDog/New Relic

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

test('POST /api/auth/login', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'password' })
    .expect(200);
  
  expect(response.body.token).toBeDefined();
});
```

### 3. Tests E2E
```typescript
// Playwright
import { test, expect } from '@playwright/test';

test('sheep tracking workflow', async ({ page }) => {
  await page.goto('/map');
  await page.waitForSelector('[data-testid="map-container"]');
  
  // Test geolocation
  await page.click('[data-testid="location-button"]');
  await expect(page.locator('[data-testid="user-marker"]')).toBeVisible();
  
  // Test sheep selection
  await page.click('[data-testid="sheep-marker"]:first-child');
  await expect(page.locator('[data-testid="sheep-popup"]')).toBeVisible();
});
```

---

## Monitoring & Logging

### 1. Logs Structurés
```typescript
// Winston logging
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

### 3. Alerting
- **Système**: Erreurs critiques, pannes
- **Performance**: Latence > 1s
- **Business**: Plus de 10% d'animaux hors zone

---

## Maintenance

### 1. Mises à Jour
- **Dépendances**: npm audit fix mensuel
- **Sécurité**: Patchs critiques immédiats
- **Fonctionnalités**: Releases trimestrielles

### 2. Sauvegardes
- **Base de données**: MongoDB dumps quotidiens
- **Configuration**: Git versioning
- **Logs**: Rotation 30 jours

### 3. Monitoring
- **Uptime**: Ping toutes les minutes
- **Performance**: Tests de charge hebdomadaires
- **Sécurité**: Scans de vulnérabilité mensuels

---

## Extensions Futures

### 1. IA & Machine Learning
- **Prédiction Santé**: Modèles d'apprentissage sur données historiques
- **Comportement**: Analyse de patterns de mouvement
- **Optimisation**: Suggestions alimentaires et de gestion

### 2. Mobile
- **Application Native**: React Native pour terrain
- **Notifications Push**: Alertes instantanées
- **Mode Hors Ligne**: Synchronisation différée

### 3. Intégrations
- **Météo**: Prévisions pour planification
- **Marché**: Prix du bétail en temps réel
- **Vétérinaires**: Téléconsultation intégrée

---

## Conclusion

Smart Shepherd Admin Dashboard représente une solution IoT complète et moderne pour la gestion d'élevage. L'architecture microservices, la communication en temps réel et l'interface utilisateur intuitive en font un outil puissant pour les éleveurs modernes.

Le projet démontre l'utilisation experte de technologies web contemporaines tout en répondant à des besoins réels d'optimisation agricole grâce à l'IoT.
