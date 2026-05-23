"""
Smart Shepherd - Python AI Service (Alternative)
Service Python Flask avec scikit-learn pour les prédictions de santé
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import joblib
import pymongo
from datetime import datetime, timedelta
import logging
import os
from typing import Dict, List, Optional, Tuple

# Configuration
app = Flask(__name__)
CORS(app)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration MongoDB
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/smart-shepherd')
DB_NAME = 'smart-shepherd'

class AIHealthPredictionService:
    """Service de prédiction de santé avec scikit-learn"""
    
    def __init__(self):
        self.anomaly_model = None
        self.lstm_model = None
        self.scaler = StandardScaler()
        self.is_initialized = False
        self.model_config = {
            'anomaly': {
                'contamination': 0.1,
                'n_estimators': 100,
                'max_samples': 'auto'
            },
            'lstm': {
                'sequence_length': 30,
                'batch_size': 32,
                'epochs': 50,
                'learning_rate': 0.001
            }
        }
        
    def initialize(self):
        """Initialiser les modèles IA"""
        try:
            logger.info("Initialisation des modèles IA...")
            
            # Charger ou créer les modèles
            self.load_or_create_models()
            
            self.is_initialized = True
            logger.info("Modèles IA initialisés avec succès")
            
        except Exception as e:
            logger.error(f"Erreur lors de l'initialisation IA: {e}")
            raise
    
    def load_or_create_models(self):
        """Charger ou créer les modèles"""
        try:
            # Essayer de charger les modèles existants
            self.anomaly_model = self.load_anomaly_model()
            
            if not self.anomaly_model:
                logger.info("Création des modèles IA...")
                self.train_models()
                
        except Exception as e:
            logger.warning(f"Impossible de charger les modèles, création en cours: {e}")
            self.train_models()
    
    def train_models(self):
        """Entraîner les modèles IA"""
        logger.info("Début de l'entraînement des modèles...")
        
        # Récupérer les données historiques
        training_data = self.get_training_data()
        
        if len(training_data) < 100:
            logger.warn("Données insuffisantes pour l'entraînement")
            return
        
        # Entraîner modèle d'anomalie
        self.anomaly_model = self.train_anomaly_model(training_data)
        
        # Sauvegarder les modèles
        self.save_models()
        
        logger.info("Entraînement des modèles terminé")
    
    def get_training_data(self) -> List[Dict]:
        """Récupérer les données d'entraînement depuis MongoDB"""
        try:
            client = pymongo.MongoClient(MONGODB_URI)
            db = client[DB_NAME]
            
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            telemetry_data = list(db.telemetrydata.find({
                'timestamp': {'$gte': thirty_days_ago}
            }).sort('timestamp', 1))
            
            client.close()
            return telemetry_data
            
        except Exception as e:
            logger.error(f"Erreur récupération données: {e}")
            return []
    
    def train_anomaly_model(self, data: List[Dict]) -> IsolationForest:
        """Entraîner le modèle d'anomalie Isolation Forest"""
        logger.info("Entraînement du modèle d'anomalie...")
        
        # Préparer les données
        features = []
        for record in data:
            features.append([
                record.get('heartRate', 70),
                record.get('temperature', 38.5),
                record.get('battery', 100),
                record.get('signalStrength', -50),
                self.normalize_activity(record.get('activity', 'idle'))
            ])
        
        X = np.array(features)
        
        # Normaliser les données
        X_scaled = self.scaler.fit_transform(X)
        
        # Créer et entraîner le modèle
        model = IsolationForest(
            contamination=self.model_config['anomaly']['contamination'],
            n_estimators=self.model_config['anomaly']['n_estimators'],
            max_samples=self.model_config['anomaly']['max_samples'],
            random_state=42
        )
        
        model.fit(X_scaled)
        
        return model
    
    def detect_anomalies(self, sheep_id: str, time_window: str = '24h') -> Dict:
        """Détecter les anomalies pour un animal"""
        if not self.anomaly_model:
            raise Exception("Modèle d'anomalie non initialisé")
        
        telemetry_data = self.get_recent_telemetry(sheep_id, time_window)
        
        if len(telemetry_data) == 0:
            return {'anomalies': [], 'risk_score': 0}
        
        # Préparer les features
        features = []
        for record in telemetry_data:
            features.append([
                record.get('heartRate', 70),
                record.get('temperature', 38.5),
                record.get('battery', 100),
                record.get('signalStrength', -50),
                self.normalize_activity(record.get('activity', 'idle'))
            ])
        
        X = np.array(features)
        X_scaled = self.scaler.transform(X)
        
        # Prédire les anomalies
        predictions = self.anomaly_model.predict(X_scaled)
        anomaly_scores = self.anomaly_model.decision_function(X_scaled)
        
        # Identifier les anomalies (-1 = anomalie)
        anomalies = []
        telemetry_data_copy = telemetry_data.copy()
        
        for i, (record, pred, score) in enumerate(zip(telemetry_data_copy, predictions, anomaly_scores)):
            if pred == -1:  # Anomalie détectée
                anomaly_score = abs(score)
                if anomaly_score > 0.1:  # Seuil d'anomalie
                    anomalies.append({
                        'timestamp': record['timestamp'].isoformat(),
                        'type': self.detect_anomaly_type(record),
                        'severity': 'high' if anomaly_score > 0.5 else 'medium',
                        'score': float(anomaly_score),
                        'values': {
                            'heartRate': record.get('heartRate'),
                            'temperature': record.get('temperature'),
                            'battery': record.get('battery'),
                            'activity': record.get('activity')
                        }
                    })
        
        # Calculer le score de risque
        risk_score = self.calculate_anomaly_risk_score(anomalies, telemetry_data)
        
        return {
            'anomalies': anomalies,
            'risk_score': risk_score,
            'analyzed_records': len(telemetry_data)
        }
    
    def predict_health_7_days(self, sheep_id: str) -> Dict:
        """Prédire la santé à J+7 (simplifié avec scikit-learn)"""
        # Pour l'instant, implémentation simplifiée avec régression linéaire
        recent_data = self.get_recent_telemetry(sheep_id, '30d')
        
        if len(recent_data) < 30:
            return {
                'prediction': None,
                'confidence': 0,
                'message': 'Données historiques insuffisantes'
            }
        
        # Préparer les données temporelles
        df = pd.DataFrame(recent_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Prédictions simples basées sur les tendances
        heart_rate_trend = self.calculate_trend(df['heartRate'].fillna(70))
        temperature_trend = self.calculate_trend(df['temperature'].fillna(38.5))
        battery_trend = self.calculate_trend(df['battery'].fillna(100))
        
        # Prédire les valeurs J+7
        last_values = df.iloc[-1]
        predicted_values = {
            'heartRate': max(40, min(200, last_values['heartRate'] + heart_rate_trend * 7)),
            'temperature': max(35, min(42, last_values['temperature'] + temperature_trend * 7)),
            'battery': max(0, min(100, last_values['battery'] + battery_trend * 7)),
            'signalStrength': last_values.get('signalStrength', -50),
            'activity': self.predict_activity(df['activity'].fillna('idle'))
        }
        
        # Calculer le score de risque
        risk_score = 0
        issues = []
        
        if predicted_values['heartRate'] < 60 or predicted_values['heartRate'] > 120:
            risk_score += 30
            issues.append('fréquence cardiaque anormale')
        
        if predicted_values['temperature'] < 38.0 or predicted_values['temperature'] > 40.5:
            risk_score += 25
            issues.append('température corporelle anormale')
        
        if predicted_values['battery'] < 20:
            risk_score += 20
            issues.append('batterie faible')
        
        confidence = min(0.9, len(recent_data) / 100)
        
        return {
            'prediction': {
                'predictedValues': predicted_values,
                'riskScore': min(100, risk_score),
                'issues': issues,
                'trend': self.determine_trend(heart_rate_trend, temperature_trend)
            },
            'confidence': confidence,
            'date': (datetime.now() + timedelta(days=7)).isoformat(),
            'inputRecords': len(recent_data)
        }
    
    def calculate_risk_score(self, sheep_id: str, data: Dict = None) -> Dict:
        """Calculer le score de risque global (0-100)"""
        try:
            # Détecter les anomalies
            anomaly_result = self.detect_anomalies(sheep_id, '24h')
            
            # Prédire la santé future
            health_prediction = self.predict_health_7_days(sheep_id)
            
            # Obtenir les tendances
            trends = self.calculate_trends(sheep_id)
            
            # Combiner les facteurs
            risk_score = 0
            
            # Anomalies récentes (40% du score)
            anomaly_risk = anomaly_result.get('risk_score', 0) if isinstance(anomaly_result, dict) else 0
            risk_score += anomaly_risk * 0.4
            
            # Prédiction santé (30% du score)
            prediction_risk = 0
            if isinstance(health_prediction, dict) and health_prediction.get('prediction'):
                prediction_risk = health_prediction['prediction'].get('riskScore', 0)
            risk_score += prediction_risk * 0.3
            
            # Tendances (20% du score)
            trends_risk = trends.get('risk_score', 0) if isinstance(trends, dict) else 0
            risk_score += trends_risk * 0.2
            
            # Facteurs de base (10% du score)
            base_risk = self.calculate_base_risk(sheep_id)
            risk_score += base_risk * 0.1
            
            # Normaliser entre 0-100
            risk_score = max(0, min(100, risk_score))
            
            # Générer les recommandations avec gestion d'erreur
            try:
                recommendations = self.get_recommendations(risk_score, anomaly_result, health_prediction)
            except Exception as rec_error:
                logger.error(f"Erreur génération recommandations: {rec_error}")
                recommendations = ['Surveillance recommandée']
            
            return {
                'overallScore': round(risk_score),
                'components': {
                    'anomalies': round(anomaly_risk),
                    'prediction': round(prediction_risk),
                    'trends': round(trends_risk),
                    'base': round(base_risk)
                },
                'level': self.get_risk_level(risk_score),
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Erreur calcul score de risque pour {sheep_id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'overallScore': 50,
                'level': 'unknown',
                'error': str(e)
            }
    
    def get_all_predictions(self) -> List[Dict]:
        """Obtenir les prédictions pour tous les animaux"""
        try:
            client = pymongo.MongoClient(MONGODB_URI)
            db = client[DB_NAME]
            
            sheep = list(db.sheep.find({'isActive': True}))
            predictions = []
            
            for animal in sheep:
                try:
                    sheep_id = animal['sheepId']
                    
                    anomalies = self.detect_anomalies(sheep_id)
                    health_prediction = self.predict_health_7_days(sheep_id)
                    risk_score = self.calculate_risk_score(sheep_id)
                    
                    predictions.append({
                        'sheepId': sheep_id,
                        'name': sheep_id,
                        'breed': animal.get('breed', 'Unknown'),
                        'age': animal.get('age', 0),
                        'anomalies': anomalies,
                        'healthPrediction': health_prediction,
                        'riskScore': risk_score,
                        'lastUpdate': datetime.now().isoformat()
                    })
                    
                except Exception as e:
                    logger.error(f"Erreur prédiction pour {animal['sheepId']}: {e}")
            
            client.close()
            return predictions
            
        except Exception as e:
            logger.error(f"Erreur récupération prédictions: {e}")
            return []
    
    # Méthodes utilitaires
    def normalize_activity(self, activity: str) -> int:
        """Normaliser l'activité en valeur numérique"""
        activity_map = {
            'idle': 0,
            'resting': 1,
            'grazing': 2,
            'walking': 3,
            'running': 4
        }
        return activity_map.get(activity, 1)
    
    def detect_anomaly_type(self, record: Dict) -> str:
        """Détecter le type d'anomalie"""
        heart_rate = record.get('heartRate')
        temperature = record.get('temperature')
        battery = record.get('battery')
        
        if heart_rate and (heart_rate < 60 or heart_rate > 120):
            return 'heart_rate'
        if temperature and (temperature < 38.0 or temperature > 40.5):
            return 'temperature'
        if battery and battery < 20:
            return 'battery'
        return 'general'
    
    def calculate_anomaly_risk_score(self, anomalies: List[Dict], data: List[Dict]) -> int:
        """Calculer le score de risque basé sur les anomalies"""
        if len(anomalies) == 0:
            return 0
        
        score = 0
        for anomaly in anomalies:
            if isinstance(anomaly, dict):
                severity = anomaly.get('severity', 'medium')
                score += 30 if severity == 'high' else 15
        
        return min(100, score)
    
    def get_risk_level(self, score: float) -> str:
        """Déterminer le niveau de risque"""
        if score < 20:
            return 'low'
        elif score < 50:
            return 'medium'
        elif score < 80:
            return 'high'
        else:
            return 'critical'
    
    def get_recommendations(self, score: float, anomalies: Dict, prediction: Dict) -> List[str]:
        """Générer des recommandations"""
        recommendations = []
        
        if score > 70:
            recommendations.append('Examen vétérinaire recommandé')
        
        if isinstance(anomalies, dict) and anomalies.get('anomalies'):
            for anomaly in anomalies['anomalies']:
                if isinstance(anomaly, dict) and anomaly.get('type') == 'heart_rate':
                    recommendations.append('Surveillance fréquence cardiaque')
                elif isinstance(anomaly, dict) and anomaly.get('type') == 'temperature':
                    recommendations.append('Vérifier température corporelle')
        
        if isinstance(prediction, dict) and prediction.get('prediction'):
            pred_risk = prediction['prediction'].get('riskScore', 0)
            if pred_risk > 60:
                recommendations.append('Planifier examen de santé préventif')
        
        return recommendations
    
    def get_recent_telemetry(self, sheep_id: str, time_window: str) -> List[Dict]:
        """Obtenir les données récentes de télémétrie"""
        try:
            client = pymongo.MongoClient(MONGODB_URI)
            db = client[DB_NAME]
            
            time_map = {
                '1h': timedelta(hours=1),
                '24h': timedelta(hours=24),
                '7d': timedelta(days=7),
                '30d': timedelta(days=30)
            }
            
            time_ago = datetime.now() - time_map.get(time_window, timedelta(hours=24))
            
            telemetry_data = list(db.telemetrydata.find({
                'sheepId': sheep_id,
                'timestamp': {'$gte': time_ago}
            }).sort('timestamp', 1))
            
            client.close()
            return telemetry_data
            
        except Exception as e:
            logger.error(f"Erreur récupération télémétrie: {e}")
            return []
    
    def calculate_trend(self, series) -> float:
        """Calculer la tendance d'une série temporelle"""
        if len(series) < 5:
            return 0
        
        # Simple régression linéaire
        x = np.arange(len(series))
        y = np.array(series)
        
        # Supprimer les NaN
        mask = ~np.isnan(y)
        x = x[mask]
        y = y[mask]
        
        if len(x) < 5:
            return 0
        
        # Calculer la pente
        slope = np.polyfit(x, y, 1)[0]
        return slope
    
    def calculate_trends(self, sheep_id: str) -> Dict:
        """Calculer les tendances pour un animal"""
        recent_data = self.get_recent_telemetry(sheep_id, '7d')
        
        if len(recent_data) < 10:
            return {'risk_score': 50, 'trend': 'insufficient_data'}
        
        # Extraire les séries temporelles
        heart_rates = [d.get('heartRate', 70) for d in recent_data]
        temperatures = [d.get('temperature', 38.5) for d in recent_data]
        batteries = [d.get('battery', 100) for d in recent_data]
        
        # Calculer les tendances
        heart_rate_trend = self.calculate_trend(heart_rates)
        temperature_trend = self.calculate_trend(temperatures)
        battery_trend = self.calculate_trend(batteries)
        
        risk_score = 50
        
        if heart_rate_trend < -5 or heart_rate_trend > 10:
            risk_score += 20
        if temperature_trend > 0.5:
            risk_score += 15
        if battery_trend < -5:
            risk_score += 10
        
        return {
            'risk_score': min(100, risk_score),
            'trends': {
                'heartRate': heart_rate_trend,
                'temperature': temperature_trend,
                'battery': battery_trend
            }
        }
    
    def calculate_base_risk(self, sheep_id: str) -> float:
        """Calculer le risque de base"""
        # Pour l'instant, retourne une valeur par défaut
        return 25
    
    def predict_activity(self, activity_series) -> str:
        """Prédire l'activité future"""
        # Simple logique basée sur la fréquence
        if len(activity_series) == 0:
            return 'idle'
        
        # Compter les occurrences
        activity_counts = {}
        for activity in activity_series:
            activity_counts[activity] = activity_counts.get(activity, 0) + 1
        
        # Retourner l'activité la plus fréquente
        return max(activity_counts, key=activity_counts.get)
    
    def determine_trend(self, heart_rate_trend: float, temperature_trend: float) -> str:
        """Déterminer la tendance globale"""
        if heart_rate_trend > 5 and temperature_trend > 0.2:
            return 'deteriorating'
        elif heart_rate_trend < -2 and temperature_trend < -0.1:
            return 'improving'
        return 'stable'
    
    def save_models(self):
        """Sauvegarder les modèles"""
        try:
            if self.anomaly_model:
                joblib.dump(self.anomaly_model, 'models/anomaly_model.pkl')
                joblib.dump(self.scaler, 'models/scaler.pkl')
            logger.info("Modèles sauvegardés")
        except Exception as e:
            logger.error(f"Erreur sauvegarde modèles: {e}")
    
    def load_anomaly_model(self) -> Optional[IsolationForest]:
        """Charger le modèle d'anomalie"""
        try:
            if os.path.exists('models/anomaly_model.pkl') and os.path.exists('models/scaler.pkl'):
                self.scaler = joblib.load('models/scaler.pkl')
                return joblib.load('models/anomaly_model.pkl')
        except Exception as e:
            logger.error(f"Erreur chargement modèle: {e}")
        return None

# Instance globale du service
ai_service = AIHealthPredictionService()

# Routes Flask
@app.route('/api/ai/initialize', methods=['POST'])
def initialize_models():
    """Initialiser les modèles IA"""
    try:
        ai_service.initialize()
        return jsonify({
            'success': True,
            'message': 'Modèles IA initialisés avec succès',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/predictions/<sheep_id>', methods=['GET'])
def get_predictions(sheep_id: str):
    """Obtenir les prédictions complètes pour un animal"""
    try:
        if not ai_service.is_initialized:
            ai_service.initialize()
        
        anomalies = ai_service.detect_anomalies(sheep_id)
        health_prediction = ai_service.predict_health_7_days(sheep_id)
        risk_score = ai_service.calculate_risk_score(sheep_id)
        
        return jsonify({
            'success': True,
            'data': {
                'sheepId': sheep_id,
                'anomalies': anomalies,
                'healthPrediction': health_prediction,
                'riskScore': risk_score,
                'timestamp': datetime.now().isoformat()
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/all-predictions', methods=['GET'])
def get_all_predictions():
    """Obtenir les prédictions pour tous les animaux"""
    try:
        if not ai_service.is_initialized:
            ai_service.initialize()
        
        predictions = ai_service.get_all_predictions()
        
        return jsonify({
            'success': True,
            'data': {
                'predictions': predictions,
                'count': len(predictions),
                'timestamp': datetime.now().isoformat()
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/health-summary', methods=['GET'])
def get_health_summary():
    """Résumé de santé IA global"""
    try:
        if not ai_service.is_initialized:
            ai_service.initialize()
        
        predictions = ai_service.get_all_predictions()
        
        # Calculer les statistiques globales
        summary = {
            'totalAnimals': len(predictions),
            'riskDistribution': {
                'low': 0,
                'medium': 0,
                'high': 0,
                'critical': 0
            },
            'averageRiskScore': 0,
            'animalsWithAnomalies': 0,
            'highRiskAnimals': [],
            'timestamp': datetime.now().isoformat()
        }
        
        total_risk = 0
        
        for pred in predictions:
            level = pred['riskScore'].get('level', 'unknown')
            if level in summary['riskDistribution']:
                summary['riskDistribution'][level] += 1
            
            total_risk += pred['riskScore'].get('overallScore', 0)
            
            if pred['anomalies'].get('anomalies'):
                summary['animalsWithAnomalies'] += 1
            
            if pred['riskScore'].get('overallScore', 0) > 70:
                summary['highRiskAnimals'].append({
                    'sheepId': pred['sheepId'],
                    'name': pred['name'],
                    'riskScore': pred['riskScore'].get('overallScore'),
                    'level': level
                })
        
        summary['averageRiskScore'] = round(total_risk / len(predictions)) if predictions else 0
        
        return jsonify({
            'success': True,
            'data': summary
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/ai/model-status', methods=['GET'])
def get_model_status():
    """Obtenir le statut des modèles IA"""
    status = {
        'isInitialized': ai_service.is_initialized,
        'anomalyModel': ai_service.anomaly_model is not None,
        'lstmModel': False,  # Non implémenté dans cette version
        'modelConfig': ai_service.model_config,
        'timestamp': datetime.now().isoformat()
    }
    
    return jsonify({
        'success': True,
        'data': status
    })

if __name__ == '__main__':
    # Initialiser le service
    ai_service.initialize()
    
    # Démarrer le serveur Flask
    app.run(host='0.0.0.0', port=5001, debug=True)
