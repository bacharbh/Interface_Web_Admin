"""Health LSTM model wrapper with a graceful fallback when TensorFlow/SHAP
are not available. This lets the AI service start in 'mock' mode on systems
where installing TensorFlow is not feasible (e.g., Windows + Python 3.14).
"""
import os
import numpy as np

# Try to import heavy ML deps; fall back to mocks when unavailable
try:
    import tensorflow as tf  # type: ignore
    HAS_TF = True
except Exception:
    tf = None
    HAS_TF = False

try:
    import shap  # type: ignore
    HAS_SHAP = True
except Exception:
    shap = None
    HAS_SHAP = False

from ..core.config import settings


class HealthLSTMModel:
    def __init__(self):
        self.model = None
        self.explainer = None
        self.feature_names = ['temperature', 'heart_rate', 'activity', 'battery', 'rssi']
        self.window_size = 120
        self.num_features = 5

    async def load(self):
        # If explicitly asked to use mock or TF missing, keep a lightweight mock
        use_mock = os.getenv('AI_USE_MOCK', 'false').lower() in ('1', 'true', 'yes')
        if use_mock or not HAS_TF:
            # Create a trivial placeholder model representation
            self.model = 'mock-model'
            # Create a simple explainer surrogate if SHAP available
            if HAS_SHAP:
                sample_input = np.random.random((10, self.window_size, self.num_features)).astype(np.float32)
                try:
                    self.explainer = shap.Explainer(lambda x: np.zeros((len(x), 1)), sample_input)
                except Exception:
                    self.explainer = None
            else:
                self.explainer = None
            return

        # Build real TF model
        self.model = self._build_model()
        if HAS_SHAP:
            try:
                sample_input = np.random.random((10, self.window_size, self.num_features)).astype(np.float32)
                self.explainer = shap.GradientExplainer(self.model, sample_input)
            except Exception:
                self.explainer = None

    def _build_model(self):
        inputs = tf.keras.Input(shape=(self.window_size, self.num_features))
        lstm_out = tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64, return_sequences=True))(inputs)

        query = tf.keras.layers.Dense(128)(lstm_out)
        key = tf.keras.layers.Dense(128)(lstm_out)
        value = tf.keras.layers.Dense(128)(lstm_out)

        attention_score = tf.keras.layers.Dot(axes=[2, 2])([query, key])
        attention_score = tf.keras.layers.Activation('softmax')(attention_score)
        attention_out = tf.keras.layers.Dot(axes=[2, 1])([attention_score, value])

        avg_pool = tf.keras.layers.GlobalAveragePooling1D()(attention_out)
        max_pool = tf.keras.layers.GlobalMaxPooling1D()(attention_out)
        concat = tf.keras.layers.Concatenate()([avg_pool, max_pool])

        x = tf.keras.layers.Dense(64, activation='relu')(concat)
        x = tf.keras.layers.Dropout(0.2)(x)
        outputs = tf.keras.layers.Dense(1, activation='sigmoid')(x)

        model = tf.keras.Model(inputs=inputs, outputs=outputs)
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        return model

    async def predict(self, window_data: np.ndarray):
        # If TF missing or mock mode, return a deterministic safe mock
        if self.model is None:
            await self.load()

        use_mock = os.getenv('AI_USE_MOCK', 'false').lower() in ('1', 'true', 'yes')
        if use_mock or not HAS_TF:
            # Produce a low random risk with a stable explanation
            risk_score = float(np.clip(np.mean(window_data) % 1.0, 0.0, 1.0)) if isinstance(window_data, np.ndarray) else 0.05
            explanation = {f: 0.2 for f in self.feature_names}
            top_contributor = self.feature_names[0]
            return risk_score, explanation, top_contributor

        # Real inference path
        prediction = self.model.predict(window_data)
        risk_score = float(prediction[0][0])

        try:
            if self.explainer is not None and HAS_SHAP:
                shap_values = self.explainer.shap_values(window_data)
                importance = np.abs(shap_values[0]).mean(axis=0)
                explanation = {self.feature_names[i]: float(importance[i]) for i in range(len(self.feature_names))}
                top_contributor = self.feature_names[int(np.argmax(importance))]
            else:
                explanation = {f: 0.1 for f in self.feature_names}
                top_contributor = 'unknown'
        except Exception:
            explanation = {f: 0.1 for f in self.feature_names}
            top_contributor = 'unknown'

        return risk_score, explanation, top_contributor


health_model = HealthLSTMModel()
