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
        risk_score = ai_service.calculate_risk_score('SHEEP_TEST_001', {})
        print(f"   ✓ Score global: {risk_score.get('overallScore', 'N/A')}")
        print(f"   ✓ Niveau: {risk_score.get('level', 'N/A')}")
        print(f"   ✓ Composantes: {risk_score.get('components', {})}")
        if 'error' in risk_score:
            print(f"   ℹ Erreur détectée: {risk_score['error']}\n")
        else:
            print(f"   ✓ Recommandations: {risk_score.get('recommendations', [])}\n")
    except Exception as e:
        import traceback
        print(f"   ✗ Erreur: {e}")
        print(f"   Traceback: {traceback.format_exc()}\n")
    
    print("=== Tests terminés ===")

if __name__ == '__main__':
    test_ai_service()
