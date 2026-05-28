# Smart Shepherd - Weather Module Documentation

## 🌤️ Module Overview

Le module météo pour Smart Shepherd permet d'intégrer les données météo en temps réel avec le suivi du troupeau, d'analyser les corrélations entre les conditions météo et le comportement animal, et de générer des alertes préventives basées sur les conditions météo.

## 🎯 Fonctionnalités Implémentées

### 1. **Service Météo Backend (OpenWeatherMap)**

#### Service: `weatherService.js`
- **Localisation**: `backend/services/weatherService.js`
- **API**: OpenWeatherMap (nécessite clé API)
- **Cache**: 10 minutes pour réduire les appels API

#### Méthodes Disponibles
- `getCurrentWeather(lat, lon)`: Météo actuelle
- `getForecast(lat, lon)`: Prévision 5 jours
- `getHistoricalWeather(lat, lon, startDate, endDate)`: Historique (simulé)
- `analyzeWeatherAlerts(weatherData)`: Analyse des alertes préventives
- `correlateWeatherWithBehavior(weatherData, telemetryData)`: Corrélation météo/comportement
- `getWeatherStatistics(lat, lon, startDate, endDate)`: Statistiques météo

### 2. **API Routes**

#### Routes: `weather.js`
- **Localisation**: `backend/routes/weather.js`
- **Base Path**: `/api/weather`

#### Endpoints
- `GET /api/weather/current?lat=&lon=`: Météo actuelle
- `GET /api/weather/forecast?lat=&lon=`: Prévision météo
- `GET /api/weather/historical?lat=&lon=&startDate=&endDate=`: Historique météo
- `GET /api/weather/alerts?lat=&lon=`: Alertes météo préventives
- `GET /api/weather/correlation?lat=&lon=&startDate=&endDate=`: Corrélation météo/comportement
- `GET /api/weather/statistics?lat=&lon=&startDate=&endDate=`: Statistiques météo
- `POST /api/weather/cache/clear`: Nettoyer le cache météo (admin)

### 3. **Service Météo Frontend**

#### Service: `weatherService.ts`
- **Localisation**: `src/services/weatherService.ts`
- **Fallback**: Données mockées si API non disponible

#### Fonctions Disponibles
- `getCurrentWeather(lat, lon)`: Obtenir la météo actuelle
- `getWeatherForecast(lat, lon)`: Obtenir la prévision
- `getWeatherAlerts(lat, lon)`: Obtenir les alertes
- `getWeatherCorrelation(lat, lon, startDate, endDate)`: Obtenir les corrélations
- `getWeatherIcon(iconCode)`: Obtenir l'URL de l'icône
- `getSeverityColor(severity)`: Obtenir la couleur de sévérité

### 4. **Overlay Météo sur Carte Leaflet**

#### Composant: `RealTimeMap.tsx`
- **Localisation**: `src/pages/Map/RealTimeMap.tsx`
- **Fonctionnalité**: Overlay précipitations OpenWeatherMap
- **Toggle**: Bouton "Météo" pour activer/désactiver

#### Éléments UI
- **Bouton Toggle**: Coin supérieur droit
- **Alertes Météo**: Affichage des alertes critiques/warning
- **Info Météo**: Température, humidité, vent en temps réel

### 5. **Dashboard Analytics Météo**

#### Composant: `Analytics.tsx`
- **Localisation**: `src/pages/Analytics/Analytics.tsx`
- **Vue**: Nouvelle vue "Météo" dans le sélecteur

#### Sections
- **Corrélation Météo/Comportement**: Analyse des corrélations détectées
- **Prévision Météo**: Prévision 5 jours avec températures, humidité, vent
- **Impact Météo**: Résumé des corrélations, prévisions, alertes actives

## 🚨 Système d'Alertes Préventives

### Types d'Alertes

#### Chaleur Extrême
- **Condition**: Température > 35°C
- **Sévérité**: CRITICAL
- **Recommandation**: Déplacer le troupeau à l'ombre, assurer l'accès à l'eau

#### Chaleur Élevée
- **Condition**: Température > 30°C
- **Sévérité**: WARNING
- **Recommandation**: Surveiller l'hydratation et l'activité

#### Gel
- **Condition**: Température < 0°C
- **Sévérité**: CRITICAL
- **Recommandation**: Rentrer le troupeau dans un abri

#### Froid
- **Condition**: Température < 5°C
- **Sévérité**: WARNING
- **Recommandation**: Surveiller l'état des animaux

#### Pluie
- **Condition**: Pluie ou orage détecté
- **Sévérité**: WARNING
- **Recommandation**: Surveiller le comportement du troupeau

#### Vent Fort
- **Condition**: Vent > 20 m/s
- **Sévérité**: WARNING
- **Recommandation**: Surveiller les déplacements

## 📊 Corrélations Météo/Comportement

### Corrélations Implémentées

#### Pluie → Activité Réduite
- **Condition**: Pluie ou orage
- **Comportement attendu**: Repos / Abri
- **Analyse**: Comparaison avec les données de télémétrie

#### Chaleur → Activité Réduite (Journée)
- **Condition**: Température > 30°C, 10h-16h
- **Comportement attendu**: Repos à l'ombre
- **Recommandation**: Surveiller l'hydratation

#### Vent Fort → Déplacements Réduits
- **Condition**: Vent > 15 m/s
- **Comportement attendu**: Déplacements limités
- **Analyse**: Impact sur les mouvements du troupeau

## 🔧 Configuration

### Variables d'Environnement

Ajoutez à votre fichier `.env`:

```env
# OpenWeatherMap API Key
OPENWEATHER_API_KEY=your_api_key_here

# Optionnel: Configuration météo avancée
WEATHER_CACHE_DURATION=600000  # 10 minutes en ms
WEATHER_UPDATE_INTERVAL=300000  # 5 minutes en ms
```

### Obtenir une Clé API OpenWeatherMap

1. Allez sur [OpenWeatherMap](https://openweathermap.org/api)
2. Créez un compte gratuit
3. Générez une clé API
4. Ajoutez-la à votre fichier `.env`

## 📁 Structure des Fichiers

### Backend
```
backend/
├── services/
│   └── weatherService.js          # Service météo OpenWeatherMap
├── routes/
│   └── weather.js                   # API routes météo
└── models/
    ├── TelemetryData.js            # Modèle télémétrie
    └── Sheep.js                     # Modèle animaux
```

### Frontend
```
src/
├── services/
│   └── weatherService.ts           # Service météo frontend
├── pages/
│   ├── Map/
│   │   └── RealTimeMap.tsx         # Carte avec overlay météo
│   └── Analytics/
│       └── Analytics.tsx            # Dashboard avec vue météo
```

## 🚀 Utilisation

### Backend - Démarrage du Serveur

```bash
cd backend
npm install
node server.js
```

### Frontend - Utilisation

#### Sur la Carte
1. Cliquez sur le bouton "Météo" en haut à droite
2. L'overlay précipitations apparaît sur la carte
3. Les alertes météo s'affichent en haut à droite
4. Les infos météo actuelles s'affichent en bas à gauche

#### Dans le Dashboard Analytics
1. Allez sur la page "Analytics"
2. Sélectionnez la vue "Météo" dans le sélecteur
3. Consultez les corrélations météo/comportement
4. Consultez la prévision météo 5 jours
5. Consultez l'impact météo sur le troupeau

### Exemples d'API

#### Obtenir la météo actuelle
```bash
curl "http://localhost:5000/api/weather/current?lat=33.885&lon=-5.54" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Obtenir les alertes météo
```bash
curl "http://localhost:5000/api/weather/alerts?lat=33.885&lon=-5.54" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Obtenir les corrélations
```bash
curl "http://localhost:5000/api/weather/correlation?lat=33.885&lon=-5.54&startDate=2026-04-15&endDate=2026-04-22" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ Notes Importantes

### API Key Requise
Le module nécessite une clé API OpenWeatherMap pour fonctionner avec des données réelles. Sans clé API, le frontend utilisera des données mockées.

### Historique Météo
L'API historique d'OpenWeatherMap nécessite un abonnement payant. Pour l'instant, le service génère des données historiques simulées basées sur les tendances saisonnières.

### Cache
Le service météo utilise un cache de 10 minutes pour réduire les appels API. Le cache peut être nettoyé via l'endpoint `/api/weather/cache/clear`.

### ES Module Compatibility
Les routes météo sont temporairement désactivées dans `server.js` pour résoudre les problèmes de compatibilité ES modules. Pour les réactiver:
1. Décommentez l'import de `weatherRoutes` dans `server.js`
2. Décommentez l'enregistrement de la route `/api/weather`
3. Assurez-vous que tous les modules middleware sont convertis en ES modules

## 🔍 Dépannage

### Erreur: "API météo non disponible"
- Vérifiez que la clé API OpenWeatherMap est configurée
- Vérifiez que le serveur backend est en cours d'exécution
- Les données mockées seront utilisées automatiquement en cas d'erreur

### Overlay météo ne s'affiche pas
- Vérifiez que le bouton "Météo" est activé
- Vérifiez que les données météo sont chargées
- Remplacez `YOUR_API_KEY` dans l'URL de l'overlay par votre clé API réelle

### Alertes non affichées
- Vérifiez que les conditions météo déclenchent des alertes
- Les alertes ne s'affichent que si des conditions critiques/warning sont détectées
- Consultez la console pour les erreurs

## 📈 Roadmap

### Fonctionnalités Futures
- [ ] Intégration API historique OpenWeatherMap (abonnement payant)
- [ ] Graphiques météo historiques sur les graphiques télémétrie
- [ ] Notifications push pour les alertes météo critiques
- [ ] Prédictions météo avancées (ML)
- [ ] Intégration avec d'autres sources météo
- [ ] Personnalisation des seuils d'alerte
- [ ] Export des données météo en Excel/CSV
- [ ] Comparaison météo entre périodes

## 🎨 Personnalisation

### Seuils d'Alerte
Modifiez les seuils dans `weatherService.js`:
```javascript
if (current.temp > 35) { // Changer le seuil
  alerts.push({
    type: 'EXTREME_HEAT',
    // ...
  });
}
```

### Couleurs de Sévérité
Modifiez les couleurs dans `weatherService.ts`:
```typescript
export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500'; // Modifier la couleur
    // ...
  }
};
```

### Overlay Météo
Modifiez l'URL de l'overlay dans `RealTimeMap.tsx`:
```typescript
url="https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY"
// Autres options: clouds_new, temp_new, wind_new, pressure_new
```

## 📞 Support

Pour toute question ou problème, consultez:
- La documentation principale: `PROJECT_DOCUMENTATION.md`
- La documentation des rapports: `REPORTS_MODULE_DOCUMENTATION.md`
- Les logs d'erreur: `backend/logs/`

---

**Version**: 1.0.0  
**Date**: 22 Avril 2026  
**Auteur**: Smart Shepherd Team
