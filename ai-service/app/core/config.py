import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Shepherd AI Service"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = "smart-shepherd"
    
    # Model Paths
    HEALTH_MODEL_PATH: str = os.getenv("HEALTH_MODEL_PATH", "models_storage/health_lstm_v1")
    BATTERY_MODEL_PATH: str = os.getenv("BATTERY_MODEL_PATH", "models_storage/battery_xgb_v1.json")
    
    # Thresholds
    RISK_THRESHOLD_HIGH: float = 0.8
    RISK_THRESHOLD_MEDIUM: float = 0.5

settings = Settings()
