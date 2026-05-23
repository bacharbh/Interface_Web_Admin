from fastapi import FastAPI
from prometheus_client import make_asgi_app, Counter, Histogram
import time

from .api.endpoints import router as api_router
from .core.config import settings
from .models.health_lstm import health_model
from .models.battery_xgb import battery_model

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Prometheus Metrics
INFERENCE_LATENCY = Histogram("ai_inference_latency_seconds", "Inference latency in seconds")
PREDICTION_COUNT = Counter("ai_predictions_total", "Total number of AI predictions", ["model_name"])

# Setup metrics app
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

@app.on_event("startup")
async def startup_event():
    # Load models into memory
    await health_model.load()
    await battery_model.load()
    print("AI Models loaded successfully")

@app.middleware("http")
async def add_process_time_header(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    # Update metrics if it's a prediction endpoint
    if "/predict" in request.url.path or "/check" in request.url.path:
        INFERENCE_LATENCY.observe(process_time)
        model_name = request.url.path.split("/")[-1]
        PREDICTION_COUNT.labels(model_name=model_name).inc()
        
    return response

@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "models_loaded": {
            "health_lstm": health_model.model is not None,
            "battery_xgb": battery_model.model is not None
        },
        "timestamp": time.time()
    }

app.include_router(api_router, prefix="/ai")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
