# Smart Shepherd - AI Module Testing Guide

## Overview

Ce guide complet explique comment tester le module IA de prédiction de santé pour Smart Shepherd, incluant les deux approches (TensorFlow.js et Python microservice).

## Prérequis

### 1. Installation Dépendances

#### Backend Node.js
```bash
cd backend
npm install @tensorflow/tfjs-node
```

#### Python Microservice
```bash
pip install flask flask-cors scikit-learn pandas pymongo joblib
```

### 2. Base de Données MongoDB
```bash
# Démarrer MongoDB
mongod --dbpath /data/db

# Ou avec Docker
docker run -d -p 27017:27017 mongo:6.0
```

### 3. Données de Test

#### Créer un script de données de test
```javascript
// scripts/createTestData.js
const mongoose = require('mongoose');
const TelemetryData = require('../backend/models/TelemetryData');
const Sheep = require('../backend/models/Sheep');

async function createTestData() {
  await mongoose.connect('mongodb://localhost:27017/smart-shepherd');
  
  // Créer animaux de test
  const testSheep = [
    {
      sheepId: 'SHEEP_001',
      breed: 'Merino',
      age: 3,
      weight: 65,
      gender: 'female',
      healthStatus: 'Good',
      deviceId: 'DEVICE_001',
      isActive: true
    },
    {
      sheepId: 'SHEEP_002', 
      breed: 'Suffolk',
      age: 2,
      weight: 70,
      gender: 'male',
      healthStatus: 'Warning',
      deviceId: 'DEVICE_002',
      isActive: true
    }
  ];
  
  await Sheep.insertMany(testSheep);
  
  // Créer données télémétrie de test (30 jours)
  const telemetryData = [];
  const now = new Date();
  
  for (let day = 0; day < 30; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - (hour * 60 * 60 * 1000));
      
      // Données normales
      telemetryData.push({
        deviceId: 'DEVICE_001',
        sheepId: 'SHEEP_001',
        timestamp,
        location: { lat: 33.885, lng: -5.54, accuracy: 5 },
        battery: 100 - (day * 0.5),
        temperature: 38.5 + Math.random() * 1.5,
        heartRate: 70 + Math.random() * 30,
        activity: hour < 6 || hour > 20 ? 'resting' : 'grazing',
        signalStrength: -50 + Math.random() * 20
      });
      
      // Données avec quelques anomalies
      const isAnomaly = Math.random() < 0.05; // 5% d'anomalies
      telemetryData.push({
        deviceId: 'DEVICE_002',
        sheepId: 'SHEEP_002',
        timestamp,
        location: { lat: 33.886, lng: -5.55, accuracy: 5 },
        battery: 80 - (day * 0.8),
        temperature: isAnomaly ? 41.2 : 38.8 + Math.random() * 1.2,
        heartRate: isAnomaly ? 140 : 75 + Math.random() * 25,
        activity: isAnomaly ? 'idle' : (hour < 6 || hour > 20 ? 'resting' : 'grazing'),
        signalStrength: -60 + Math.random() * 25
      });
    }
  }
  
  await TelemetryData.insertMany(telemetryData);
  console.log(`Created ${telemetryData.length} telemetry records`);
  
  await mongoose.disconnect();
}

createTestData().catch(console.error);
```

Lancer le script:
```bash
node scripts/createTestData.js
```

## Testing Approche 1: TensorFlow.js (Node.js)

### 1. Démarrer le Backend

```bash
cd backend
npm run dev
```

### 2. Initialiser le Service IA

```bash
# Via API
curl -X POST http://localhost:5000/api/ai/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Tests API

#### Test 1: Vérifier le statut des modèles
```bash
curl -X GET http://localhost:5000/api/ai/model-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Réponse attendue:**
```json
{
  "success": true,
  "data": {
    "isInitialized": true,
    "anomalyModel": true,
    "lstmModel": true,
    "modelConfig": {...}
  }
}
```

#### Test 2: Détecter les anomalies
```bash
curl -X GET http://localhost:5000/api/ai/anomalies/SHEEP_001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 3: Prédiction J+7
```bash
curl -X GET http://localhost:5000/api/ai/prediction-7days/SHEEP_001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 4: Score de risque
```bash
curl -X GET http://localhost:5000/api/ai/risk-score/SHEEP_001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 5: Prédictions complètes
```bash
curl -X GET http://localhost:5000/api/ai/predictions/SHEEP_001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test 6: Résumé global
```bash
curl -X GET http://localhost:5000/api/ai/health-summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Tests Unitaires

Créer `backend/tests/aiService.test.js`:
```javascript
const aiService = require('../services/aiHealthPrediction');
const TelemetryData = require('../models/TelemetryData');

describe('AI Health Prediction Service', () => {
  beforeAll(async () => {
    await aiService.initialize();
  });

  test('should detect anomalies', async () => {
    const result = await aiService.detectAnomalies('SHEEP_001');
    expect(result).toHaveProperty('anomalies');
    expect(result).toHaveProperty('riskScore');
    expect(Array.isArray(result.anomalies)).toBe(true);
  });

  test('should predict health 7 days', async () => {
    const result = await aiService.predictHealth7Days('SHEEP_001');
    expect(result).toHaveProperty('prediction');
    expect(result).toHaveProperty('confidence');
  });

  test('should calculate risk score', async () => {
    const result = await aiService.calculateRiskScore('SHEEP_001');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('level');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
```

Lancer les tests:
```bash
cd backend
npm test -- aiService.test.js
```

## Testing Approche 2: Python Microservice

### 1. Démarrer le Service Python

```bash
python backend/services/pythonAIService.py
```

Le service démarrera sur `http://localhost:5001`

### 2. Tests API Python

#### Test 1: Initialisation
```bash
curl -X POST http://localhost:5001/api/ai/initialize
```

#### Test 2: Statut des modèles
```bash
curl -X GET http://localhost:5001/api/ai/model-status
```

#### Test 3: Prédictions par animal
```bash
curl -X GET http://localhost:5001/api/ai/predictions/SHEEP_001
```

#### Test 4: Résumé global
```bash
curl -X GET http://localhost:5001/api/ai/health-summary
```

### 3. Tests Python Unitaires

Créer `backend/tests/test_ai_service.py`:
```python
import unittest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))

from pythonAIService import AIHealthPredictionService

class TestAIHealthPredictionService(unittest.TestCase):
    
    def setUp(self):
        self.ai_service = AIHealthPredictionService()
        self.ai_service.initialize()
    
    def test_detect_anomalies(self):
        """Test la détection d'anomalies"""
        result = self.ai_service.detect_anomalies('SHEEP_001')
        
        self.assertIn('anomalies', result)
        self.assertIn('risk_score', result)
        self.assertIsInstance(result['anomalies'], list)
        self.assertIsInstance(result['risk_score'], (int, float))
    
    def test_predict_health_7_days(self):
        """Test la prédiction de santé J+7"""
        result = self.ai_service.predict_health_7_days('SHEEP_001')
        
        self.assertIn('prediction', result)
        self.assertIn('confidence', result)
        
        if result['prediction']:
            self.assertIn('predictedValues', result['prediction'])
            self.assertIn('riskScore', result['prediction'])
    
    def test_calculate_risk_score(self):
        """Test le calcul du score de risque"""
        result = self.ai_service.calculate_risk_score('SHEEP_001')
        
        self.assertIn('overallScore', result)
        self.assertIn('level', result)
        self.assertGreaterEqual(result['overallScore'], 0)
        self.assertLessEqual(result['overallScore'], 100)
    
    def test_get_all_predictions(self):
        """Test la récupération de toutes les prédictions"""
        result = self.ai_service.get_all_predictions()
        
        self.assertIsInstance(result, list)
        if len(result) > 0:
            self.assertIn('sheepId', result[0])
            self.assertIn('riskScore', result[0])

if __name__ == '__main__':
    unittest.main()
```

Lancer les tests:
```bash
cd backend
python -m pytest tests/test_ai_service.py -v
```

## Testing Frontend Dashboard

### 1. Démarrer le Frontend

```bash
npm run dev
```

### 2. Accéder au Dashboard IA

Naviguer vers: `http://localhost:5173/ai-dashboard`

### 3. Tests Manuelux Frontend

#### Test 1: Chargement du Dashboard
- Vérifier que le dashboard se charge correctement
- Confirmer l'affichage des statistiques globales
- Vérifier les graphiques de distribution des risques

#### Test 2: Navigation entre onglets
- Cliquer sur "Vue d'ensemble"
- Cliquer sur "Prédictions" 
- Cliquer sur "Anomalies"
- Vérifier le bon fonctionnement de chaque onglet

#### Test 3: Détails animal
- Cliquer sur une prédiction d'animal
- Vérifier l'ouverture de la modal
- Confirmer l'affichage des détails complets

#### Test 4: Actualisation
- Cliquer sur le bouton "Actualiser"
- Vérifier la mise à jour des données

### 4. Tests Frontend Automatisés

Créer `src/components/ai/__tests__/AIPredictionDashboard.test.tsx`:
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AIPredictionDashboard from '../AIPredictionDashboard';

// Mock des fetch
global.fetch = jest.fn();

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

describe('AIPredictionDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    (fetch as jest.Mock).mockClear();
  });

  test('renders dashboard with loading state', () => {
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { predictions: [], count: 0 }
        })
      }), 100))
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AIPredictionDashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText('Chargement des prédictions IA...')).toBeInTheDocument();
  });

  test('renders dashboard with data', async () => {
    const mockData = {
      success: true,
      data: {
        predictions: [
          {
            sheepId: 'SHEEP_001',
            name: 'SHEEP_001',
            riskScore: { overallScore: 25, level: 'low' },
            anomalies: { anomalies: [], riskScore: 0 }
          }
        ],
        count: 1
      }
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AIPredictionDashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard IA')).toBeInTheDocument();
      expect(screen.getByText('Vue d\'ensemble')).toBeInTheDocument();
    });
  });
});
```

## Testing Intégration Complet

### 1. Test End-to-End

Créer `tests/e2e/ai-prediction.e2e.js`:
```javascript
const { test, expect } = require('@playwright/test');

test.describe('AI Prediction E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('complete AI prediction workflow', async ({ page }) => {
    // Naviguer vers le dashboard IA
    await page.goto('/ai-dashboard');
    
    // Attendre le chargement
    await page.waitForSelector('[data-testid="ai-dashboard"]');
    
    // Vérifier l'en-tête
    await expect(page.locator('h1')).toContainText('Dashboard IA');
    
    // Tester l'onglet Vue d'ensemble
    await page.click('text=Vue d\'ensemble');
    await expect(page.locator('[data-testid="total-animals"]')).toBeVisible();
    
    // Tester l'onglet Prédictions
    await page.click('text=Prédictions');
    await expect(page.locator('[data-testid="predictions-list"]')).toBeVisible();
    
    // Cliquer sur une prédiction
    await page.click('[data-testid="prediction-item"]:first-child');
    await expect(page.locator('[data-testid="animal-detail-modal"]')).toBeVisible();
    
    // Fermer la modal
    await page.click('[data-testid="close-modal"]');
    
    // Tester l'onglet Anomalies
    await page.click('text=Anomalies');
    await expect(page.locator('[data-testid="anomalies-list"]')).toBeVisible();
  });
});
```

Lancer les tests E2E:
```bash
npx playwright test tests/e2e/ai-prediction.e2e.js
```

### 2. Test de Performance

Créer `tests/performance/ai-performance.test.js`:
```javascript
const { performance } = require('perf_hooks');

describe('AI Performance Tests', () => {
  test('anomaly detection performance', async () => {
    const aiService = require('../backend/services/aiHealthPrediction');
    await aiService.initialize();
    
    const start = performance.now();
    const result = await aiService.detectAnomalies('SHEEP_001');
    const end = performance.now();
    
    console.log(`Anomaly detection took ${end - start} milliseconds`);
    expect(end - start).toBeLessThan(1000); // Moins de 1 seconde
  });

  test('7-day prediction performance', async () => {
    const aiService = require('../backend/services/aiHealthPrediction');
    await aiService.initialize();
    
    const start = performance.now();
    const result = await aiService.predictHealth7Days('SHEEP_001');
    const end = performance.now();
    
    console.log(`7-day prediction took ${end - start} milliseconds`);
    expect(end - start).toBeLessThan(2000); // Moins de 2 secondes
  });
});
```

## Dépannage

### Problèmes Communs

#### 1. TensorFlow.js Installation Error
```bash
# Solution: Installer la version compatible
npm install @tensorflow/tfjs-node@4.10.0
```

#### 2. MongoDB Connection Error
```bash
# Vérifier que MongoDB tourne
mongosh --eval "db.adminCommand('ping')"
```

#### 3. Pas assez de données pour l'entraînement
```bash
# Créer plus de données de test
node scripts/createTestData.js
```

#### 4. Python ModuleNotFoundError
```bash
# Installer les dépendances manquantes
pip install flask flask-cors scikit-learn pandas pymongo joblib
```

### Logs et Debugging

#### Backend Logs
```bash
cd backend
npm run dev 2>&1 | tee backend.log
```

#### Python Service Logs
```bash
python backend/services/pythonAIService.py 2>&1 | tee python-ai.log
```

#### Frontend Logs
Ouvrir les DevTools dans le navigateur et vérifier la console.

## Validation des Résultats

### Critères de Succès

1. **Anomalie Detection**: Doit détecter les anomalies avec une précision > 80%
2. **Prédiction J+7**: Doit fournir des prédictions avec une confiance > 70%
3. **Performance**: Temps de réponse < 2 secondes pour toutes les API
4. **Dashboard**: Interface responsive et fonctionnelle
5. **Intégration**: Communication fluide entre frontend et backend

### Tests de Validation

```bash
# Lancer tous les tests
npm test                    # Tests unitaires backend
npm run test:e2e           # Tests E2E
npm run test:performance   # Tests de performance
python -m pytest          # Tests Python
```

Ce guide complet vous permet de tester toutes les fonctionnalités du module IA de manière approfondie!
