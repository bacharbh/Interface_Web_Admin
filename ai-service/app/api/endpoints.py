from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import time

from ..models.health_lstm import health_model
from ..models.battery_xgb import battery_model
from ..models.gps_kalman import gps_kalman

router = APIRouter()

# --- Schemas ---

class HealthCheckRequest(BaseModel):
    animalId: str
    windowData: List[List[float]] # 120 x 5

class HealthCheckResponse(BaseModel):
    riskScore: float
    alertLevel: str
    explanation: dict
    topContributor: str

class BatteryResponse(BaseModel):
    estimatedHoursRemaining: float
    confidence: float
    recommendation: str

class GpsPoint(BaseModel):
    lat: float
    lng: float

class PositionPredictRequest(BaseModel):
    lastKnownGps: List[float]
    lastKnownTimestamp: str
    herdPositions: List[GpsPoint]

class PositionPredictResponse(BaseModel):
    estimatedLat: float
    estimatedLng: float
    confidenceRadiusMeters: float

# --- Endpoints ---

@router.post("/health-check", response_model=HealthCheckResponse)
async def predict_health(request: HealthCheckRequest):
    # Data validation
    data = np.array(request.windowData)
    if data.shape != (120, 5):
        raise HTTPException(status_code=400, detail="Invalid data shape. Expected (120, 5)")
    
    # Reshape for model (batch, timesteps, features)
    input_data = data.reshape(1, 120, 5).astype(np.float32)
    
    risk_score, explanation, top_contributor = await health_model.predict(input_data)
    
    alert_level = 'low'
    if risk_score > 0.8:
        alert_level = 'high'
    elif risk_score > 0.5:
        alert_level = 'medium'
        
    return {
        "riskScore": risk_score,
        "alertLevel": alert_level,
        "explanation": explanation,
        "topContributor": top_contributor
    }

@router.get("/battery-rul/{device_id}", response_model=BatteryResponse)
async def predict_battery(device_id: str):
    raise HTTPException(status_code=503, detail="Aucune donnee disponible pour ce device")

@router.post("/predict-position", response_model=PositionPredictResponse)
async def predict_position(request: PositionPredictRequest):
    if len(request.herdPositions) < 2:
        raise HTTPException(status_code=404, detail="Aucune donnee disponible")

    latest = request.herdPositions[-1]
    previous = request.herdPositions[-2]
    herd_dx = latest.lat - previous.lat
    herd_dy = latest.lng - previous.lng

    last_v = [herd_dx, herd_dy]

    est_lat, est_lng, radius = gps_kalman.predict_position(
        request.lastKnownGps,
        last_v,
        [herd_dx, herd_dy]
    )

    return {
        "estimatedLat": est_lat,
        "estimatedLng": est_lng,
        "confidenceRadiusMeters": radius
    }

