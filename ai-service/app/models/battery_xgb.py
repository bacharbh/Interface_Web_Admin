import os
import numpy as np
from ..core.config import settings


class _MockBooster:
    def __init__(self):
        pass

    def predict(self, dmatrix):
        # Return a stable mock prediction (hours)
        return np.array([120.0])


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
            # Mock trained model parameters if file doesn't exist or xgboost missing
            self.model = self._create_mock_booster()

    def _create_mock_booster(self):
        # Create a dummy booster if xgboost available, otherwise a simple mock
        if self._has_xgb:
            import xgboost as xgb  # type: ignore
            dtrain = xgb.DMatrix(np.random.rand(1, 4), label=[100])
            model = xgb.train({'objective': 'reg:squarederror'}, dtrain)
            return model
        else:
            return _MockBooster()

    async def predict(self, features: list):
        """
        features = [current_voltage, discharge_rate_7d, temperature_avg, charge_cycles_count]
        """
        if self.model is None:
            await self.load()

        # If xgboost present, use its DMatrix; otherwise the mock returns a fixed value
        if self._has_xgb:
            import xgboost as xgb  # type: ignore
            dmatrix = xgb.DMatrix(np.array([features]))
            prediction = self.model.predict(dmatrix)
            estimated_hours = float(prediction[0])
        else:
            estimated_hours = float(self.model.predict(None)[0])

        confidence = 0.92  # Static confidence for demo

        recommendation = "Normal"
        if estimated_hours < 48:
            recommendation = "Replacement Required within 48h"
        elif estimated_hours < 168:
            recommendation = "Monitor Closely - Battery degradation detected"

        return estimated_hours, confidence, recommendation


battery_model = BatteryRULModel()
