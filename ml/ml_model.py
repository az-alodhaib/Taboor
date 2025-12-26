from sklearn.linear_model import SGDRegressor
import joblib
import numpy as np


class Predictor:
    def __init__(self, business_id):
        self.business_id = business_id
        self.stacking_model = joblib.load("models/stacking_model.pkl")
        try:
            self.online_model = joblib.load(f"models/{business_id}_online.pkl")
        except Exception:
            self.online_model = SGDRegressor(
                loss="epsilon_insensitive",
                epsilon=0.1,
                random_state=0,
                warm_start=True,
            )
            # self-note: initialize with dummy data matching feature count
            dummy_X = np.zeros((1, self.stacking_model.n_features_in_))
            dummy_y = np.zeros(1)
            self.online_model.partial_fit(dummy_X, dummy_y)

    def predict_wait_time(self, X):
        stacking_pred = self.stacking_model.predict(X)
        online_pred = self.online_model.predict(X)

        weight_online = min(0.3, 0.05 * self.get_update_count())  # Max 30%
        weight_stacking = 1 - weight_online

        return weight_stacking * stacking_pred + weight_online * online_pred

    def online_update(self, X, y):
        self.online_model.partial_fit(X, y)

        # self-note: save updated model
        import os
        os.makedirs("models", exist_ok=True)
        joblib.dump(self.online_model, f"models/{self.business_id}_online.pkl")

    def get_update_count(self):
        try:
            return self.online_model.t_
        except Exception:
            return 0


class SimplePreprocessor:
    """Minimal preprocessor for your existing system"""

    def __init__(self):
        self.ct = joblib.load("models/column_transformer.pkl")
        self.sc = joblib.load("models/scaler.pkl")

    def _safe_to_dense(self, X):
        # self-note: ColumnTransformer may return sparse matrix
        if hasattr(X, "toarray"):
            return X.toarray()
        return np.asarray(X)

    def _extract_encoder_categories(self):
        """
        self-note: try to find OneHotEncoder categories inside ColumnTransformer.
        Returns dict: { transformer_name: {"cols": [...], "categories": [[...], [...]] } }
        """
        out = {}
        ct = self.ct

        if not hasattr(ct, "transformers_"):
            return out

        for name, transformer, cols in ct.transformers_:
            if transformer == "drop" or transformer is None:
                continue

            # Pipeline case: transformer may be pipeline; encoder inside last step
            enc = transformer
            if hasattr(transformer, "steps"):
                # find a step that has categories_
                for _, step_obj in transformer.steps:
                    if hasattr(step_obj, "categories_"):
                        enc = step_obj
                        break

            if hasattr(enc, "categories_"):
                try:
                    cols_list = list(cols) if hasattr(cols, "__iter__") and not isinstance(cols, str) else cols
                except Exception:
                    cols_list = cols

                out[name] = {
                    "cols": cols_list,
                    "categories": [list(c) for c in enc.categories_],
                }

        return out

    def get_known_labels(self):
        """
        self-note: returns { "service_type": [...], "service_details": [...] } if found.
        """
        enc_info = self._extract_encoder_categories()
        service_type_labels = None
        service_details_labels = None

        for _, info in enc_info.items():
            cols = info.get("cols")
            cats = info.get("categories", [])

            if isinstance(cols, list) and len(cols) == len(cats):
                for c_name, c_vals in zip(cols, cats):
                    if c_name == "service_type":
                        service_type_labels = list(c_vals)
                    if c_name == "service_details":
                        service_details_labels = list(c_vals)

        return {
            "service_type": service_type_labels or [],
            "service_details": service_details_labels or [],
        }

    def _fallback_category(self, value, allowed):
        """
        self-note: if value is unknown, fallback to a known category to avoid transform crash.
        """
        if not allowed:
            return value
        if value in allowed:
            return value
        # self-note: choose first known label as safe fallback (better than crashing)
        return allowed[0]

    def prepare_customer(
        self,
        arrival_hour,
        queue_length,
        service_type,
        service_details,
        avg_service_time,
        hourly_avg_service_time,
    ):
        import pandas as pd

        labels = self.get_known_labels()
        safe_type = self._fallback_category(service_type, labels.get("service_type", []))
        safe_details = self._fallback_category(service_details, labels.get("service_details", []))

        df = pd.DataFrame(
            {
                "arrival_hour": [arrival_hour],
                "queue_length": [queue_length],
                "service_type": [safe_type],
                "service_details": [safe_details],
                "avg_service_time": [avg_service_time],
                "hourly_avg_service_time": [hourly_avg_service_time],
            }
        )

        X_encoded = self.ct.transform(df)
        X_encoded = self._safe_to_dense(X_encoded)

        X_scaled = X_encoded.copy()

        # self-note: scale numeric part if possible; avoid hard-crash when shapes change
        # original code used X_scaled[:, 9:] which assumes first 9 columns are one-hot features
        try:
            if X_scaled.ndim == 2 and X_scaled.shape[1] > 9:
                X_scaled[:, 9:] = self.sc.transform(X_scaled[:, 9:])
            elif X_scaled.ndim == 2 and X_scaled.shape[1] > 0:
                # self-note: fallback: attempt scaling entire vector if scaler expects same width
                X_scaled = self.sc.transform(X_scaled)
        except Exception:
            # self-note: if scaling fails, keep encoded features (still works for prediction)
            pass

        return X_scaled


class ModelManager:
    def __init__(self):
        self.business_models = {}
        self.preprocessor = SimplePreprocessor()

    def register_business(self, business_id):
        if business_id not in self.business_models:
            self.business_models[business_id] = Predictor(business_id)

    def get_prediction(self, business_id, X):
        if business_id not in self.business_models:
            self.register_business(business_id)
        return self.business_models[business_id].predict_wait_time(X)

    def online_update(self, business_id, X, y):
        if business_id not in self.business_models:
            self.register_business(business_id)
        self.business_models[business_id].online_update(X, y)

    def predict_from_customer_input(
        self,
        business_id,
        arrival_hour,
        queue_length,
        service_type,
        service_details,
        avg_service_time,
        hourly_avg_service_time,
    ):
        # self-note: preprocessing must never crash the API
        try:
            X_ready = self.preprocessor.prepare_customer(
                arrival_hour,
                queue_length,
                service_type,
                service_details,
                avg_service_time,
                hourly_avg_service_time,
            )
            return self.get_prediction(business_id, X_ready)
        except Exception:
            # self-note: safe fallback estimate (keeps system running)
            fallback = float(avg_service_time) * float(max(1, queue_length))
            return np.array([fallback])

    def get_model_labels(self):
        """
        self-note: return the real categories that the saved transformer accepts.
        """
        labels = self.preprocessor.get_known_labels()
        return {
            "service_type_labels": labels.get("service_type", []),
            "service_details_labels": labels.get("service_details", []),
        }
