import os
import numpy as np
from ..core.config import settings


class BatteryRULModel:
    def __init__(self):
        self.model = None
        self._has_xgb = None

    async def load(self):
        # Lazy check for xgboost to avoid hard dependency at import time
        try:
            import xgboost as xgb  # type: ignore
            self._has_xgb = True
        except Exception:
            xgb = None
            self._has_xgb = False

        if os.path.exists(settings.BATTERY_MODEL_PATH) and self._has_xgb:
            self.model = xgb.Booster()
            self.model.load_model(settings.BATTERY_MODEL_PATH)
        else:
            self.model = None

    async def predict(self, features: list):
        """
        features = [current_voltage, discharge_rate_7d, temperature_avg, charge_cycles_count]
        """
        if self.model is None:
            await self.load()
        if self.model is None or not self._has_xgb:
            raise RuntimeError("Battery model unavailable")

        import xgboost as xgb  # type: ignore
        dmatrix = xgb.DMatrix(np.array([features]))
        prediction = self.model.predict(dmatrix)
        estimated_hours = float(prediction[0])

        confidence = 0.92

        recommendation = "Normal"
        if estimated_hours < 48:
            recommendation = "Replacement Required within 48h"
        elif estimated_hours < 168:
            recommendation = "Monitor Closely - Battery degradation detected"

        return estimated_hours, confidence, recommendation


battery_model = BatteryRULModel()
