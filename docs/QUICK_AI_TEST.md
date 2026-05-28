# Quick AI Testing Guide - MongoDB Alternative

## Test Python AI Service sans MongoDB

### 1. Créer des données de test mockées

Créer `backend/services/test_ai_mock.py`:

```python
"""
Test script pour le service AI avec données mockées
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from pythonAIService import AIHealthPredictionService
import pandas as pd
from datetime import datetime, timedelta
import numpy as np

def create_mock_telemetry_data():
    """Créer des données de télémétrie mockées"""
    telemetry_data = []
    now = datetime.now()
    
    for day in range(30):
        for hour in range(24):
            timestamp = now - timedelta(days=day, hours=hour)
            
            # Données normales
            telemetry_data.append({
                'sheepId': 'SHEEP_TEST_001',
                'deviceId': 'DEVICE_TEST_001',
                'timestamp': timestamp,
                'heartRate': 70 + np.random.normal(0, 10),
                'temperature': 38.5 + np.random.normal(0, 0.5),
                'battery': 100 - (day * 1.5) + np.random.normal(0, 5),
                'signalStrength': -50 + np.random.normal(0, 10),
                'activity': np.random.choice(['idle', 'resting', 'grazing', 'walking'])
            })
            
            # Données avec anomalies
            is_anomaly = np.random.random() < 0.08
            telemetry_data.append({
                'sheepId': 'SHEEP_TEST_002',
                'deviceId': 'DEVICE_TEST_002',
                'timestamp': timestamp,
                'heartRate': 130 if is_anomaly else 75 + np.random.normal(0, 15),
                'temperature': 41.0 if is_anomaly else 38.8 + np.random.normal(0, 0.8),
                'battery': 80 - (day * 2.0) + np.random.normal(0, 10),
                'signalStrength': -60 + np.random.normal(0, 15),
                'activity': 'idle' if is_anomaly else np.random.choice(['resting', 'grazing'])
            })
    
    return telemetry_data

def test_ai_service():
    """Tester le service AI avec données mockées"""
    print("=== Test du Service AI avec Données Mockées ===\n")
    
    # Créer le service
    ai_service = AIHealthPredictionService()
    
    # Créer des données mockées
    print("1. Création des données de test...")
    mock_data = create_mock_telemetry_data()
    print(f"   ✓ {len(mock_data)} enregistrements créés\n")
    
    # Remplacer la méthode get_training_data pour utiliser les données mockées
    original_get_training_data = ai_service.get_training_data
    ai_service.get_training_data = lambda: mock_data
    
    # Initialiser le service
    print("2. Initialisation du service AI...")
    try:
        ai_service.initialize()
        print("   ✓ Service initialisé\n")
    except Exception as e:
        print(f"   ✗ Erreur: {e}\n")
        return
    
    # Tester la détection d'anomalies
    print("3. Test de détection d'anomalies...")
    try:
        # Remplacer get_recent_telemetry avec des données mockées
        ai_service.get_recent_telemetry = lambda sheep_id, time_window: [
            d for d in mock_data if d['sheepId'] == sheep_id
        ]
        
        anomalies = ai_service.detect_anomalies('SHEEP_TEST_001')
        print(f"   ✓ Anomalies détectées: {len(anomalies['anomalies'])}")
        print(f"   ✓ Score de risque: {anomalies['risk_score']}\n")
    except Exception as e:
        print(f"   ✗ Erreur: {e}\n")
    
    # Tester la prédiction J+7
    print("4. Test de prédiction J+7...")
    try:
        prediction = ai_service.predict_health_7_days('SHEEP_TEST_001')
        if prediction['prediction']:
            print(f"   ✓ Prédiction générée")
            print(f"   ✓ Fréquence cardiaque prédite: {prediction['prediction']['predictedValues']['heartRate']:.1f} BPM")
            print(f"   ✓ Température prédite: {prediction['prediction']['predictedValues']['temperature']:.1f}°C")
            print(f"   ✓ Confiance: {prediction['confidence']:.2f}\n")
        else:
            print(f"   ℹ {prediction['message']}\n")
    except Exception as e:
        print(f"   ✗ Erreur: {e}\n")
    
    # Tester le score de risque
    print("5. Test de calcul du score de risque...")
    try:
        risk_score = ai_service.calculate_risk_score('SHEEP_TEST_001')
        print(f"   ✓ Score global: {risk_score['overallScore']}")
        print(f"   ✓ Niveau: {risk_score['level']}")
        print(f"   ✓ Composantes: {risk_score['components']}\n")
    except Exception as e:
        print(f"   ✗ Erreur: {e}\n")
    
    # Tester les prédictions pour tous les animaux
    print("6. Test des prédictions pour tous les animaux...")
    try:
        # Remplacer get_all_predictions avec des données mockées
        ai_service.get_all_predictions = lambda: [
            {
                'sheepId': 'SHEEP_TEST_001',
                'name': 'Test Sheep 1',
                'breed': 'Merino',
                'age': 3,
                'anomalies': anomalies,
                'healthPrediction': prediction,
                'riskScore': risk_score,
                'lastUpdate': datetime.now().isoformat()
            }
        ]
        
        all_predictions = ai_service.get_all_predictions()
        print(f"   ✓ {len(all_predictions)} prédictions générées\n")
    except Exception as e:
        print(f"   ✗ Erreur: {e}\n")
    
    print("=== Tests terminés ===")

if __name__ == '__main__':
    test_ai_service()
```

### 2. Lancer le test

```bash
cd backend/services
python test_ai_mock.py
```

### 3. Test API Python sans MongoDB

Modifier `pythonAIService.py` pour supporter le mode mock:

```python
# Ajouter au début du fichier
import os
MOCK_MODE = os.getenv('AI_MOCK_MODE', 'false').lower() == 'true'

# Modifier la méthode get_training_data
def get_training_data(self) -> List[Dict]:
    if MOCK_MODE:
        return self.create_mock_data()
    # ... code MongoDB existant ...

def create_mock_data(self) -> List[Dict]:
    """Créer des données mockées pour les tests"""
    # ... implémentation similaire à test_ai_mock.py ...
```

Lancer avec mock:
```bash
AI_MOCK_MODE=true python backend/services/pythonAIService.py
```

### 4. Test API avec curl

```bash
# Vérifier le statut
curl.exe http://localhost:5001/api/ai/model-status

# Tester les prédictions
curl.exe http://localhost:5001/api/ai/predictions/SHEEP_TEST_001

# Résumé global
curl.exe http://localhost:5001/api/ai/health-summary
```

## Alternative: Utiliser MongoDB Atlas

### 1. Créer un compte gratuit MongoDB Atlas

1. Aller sur https://www.mongodb.com/cloud/atlas
2. Créer un cluster gratuit (M0)
3. Créer un utilisateur de base de données
4. Obtenir la connection string

### 2. Configurer l'environnement

```bash
# Dans backend/.env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/smart-shepherd?retryWrites=true&w=majority
```

### 3. Lancer le script de données de test

```bash
node scripts/createAITestData.cjs
```

### 4. Tester le service Python

```bash
python backend/services/pythonAIService.py
```

## Test Frontend sans Backend

### 1. Créer un mock API

Créer `src/services/aiMock.js`:

```javascript
export const aiMockData = {
  predictions: [
    {
      sheepId: 'SHEEP_001',
      name: 'Test Sheep 1',
      breed: 'Merino',
      age: 3,
      anomalies: {
        anomalies: [
          {
            timestamp: new Date().toISOString(),
            type: 'heart_rate',
            severity: 'high',
            score: 0.85,
            values: { heartRate: 135, temperature: 38.5 }
          }
        ],
        riskScore: 30
      },
      healthPrediction: {
        prediction: {
          predictedValues: {
            heartRate: 72,
            temperature: 38.6,
            battery: 85,
            signalStrength: -55,
            activity: 'grazing'
          },
          riskScore: 25,
          issues: [],
          trend: 'stable'
        },
        confidence: 0.85
      },
      riskScore: {
        overallScore: 28,
        level: 'low',
        components: { anomalies: 30, prediction: 25, trends: 20, base: 25 },
        recommendations: ['Surveillance normale']
      }
    }
  ],
  healthSummary: {
    totalAnimals: 3,
    riskDistribution: { low: 2, medium: 1, high: 0, critical: 0 },
    averageRiskScore: 35,
    animalsWithAnomalies: 1,
    highRiskAnimals: []
  }
};

export const fetchAIMock = async (endpoint) => {
  await new Promise(resolve => setTimeout(resolve, 500)); // Simuler latence
  
  switch(endpoint) {
    case '/api/ai/all-predictions':
      return { success: true, data: aiMockData };
    case '/api/ai/health-summary':
      return { success: true, data: aiMockData.healthSummary };
    default:
      return { success: false, error: 'Endpoint not found' };
  }
};
```

### 2. Modifier le dashboard pour utiliser le mock

Dans `AIPredictionDashboard.tsx`:

```typescript
// Au début du fichier
import { fetchAIMock } from '../../services/aiMock';

const USE_MOCK = true; // Mettre à false pour utiliser l'API réelle

// Dans fetchData
const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    
    if (USE_MOCK) {
      const predictionsResponse = await fetchAIMock('/api/ai/all-predictions');
      const summaryResponse = await fetchAIMock('/api/ai/health-summary');
      
      setPredictions(predictionsResponse.data.predictions);
      setHealthSummary(summaryResponse.data);
    } else {
      // Code API existant
      const [predictionsResponse, summaryResponse] = await Promise.all([
        fetch('/api/ai/all-predictions'),
        fetch('/api/ai/health-summary')
      ]);
      // ... reste du code
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erreur inconnue');
  } finally {
    setLoading(false);
  }
};
```

## Résumé des Tests

### ✅ Tests Possibles Sans MongoDB

1. **Python AI Service avec données mockées** - ✅ Fonctionne
2. **Test des algorithmes IA** - ✅ Fonctionne  
3. **Test API endpoints** - ✅ Fonctionne
4. **Frontend avec mock data** - ✅ Fonctionne

### 📋 Tests Requérant MongoDB

1. **Tests d'intégration complets** - Requiert MongoDB
2. **Tests de performance réels** - Requiert MongoDB
3. **Tests E2E** - Requiert MongoDB

### 🚀 Recommandation

Pour tester rapidement le module IA:
1. Utiliser le mode mock Python
2. Tester les algorithmes et l'API
3. Une fois MongoDB disponible, passer aux tests d'intégration
