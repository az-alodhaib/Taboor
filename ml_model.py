from sklearn.linear_model import SGDRegressor
import joblib
import numpy as np


class Predictor:
    def __init__(self, business_id):
        self.business_id = business_id
        self.stacking_model = joblib.load("models/stacking_model.pkl")
        try:
            self.online_model = joblib.load(f"models/{business_id}_online.pkl")
        except:
            self.online_model = SGDRegressor(loss='epsilon_insensitive', epsilon=0.1, random_state=0,warm_start=True)
            # Initialize with dummy data matching feature count
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
        
        # Save updated model
        import os
        os.makedirs("models", exist_ok=True)
        joblib.dump(self.online_model, f"models/{self.business_id}_online.pkl")
    
    def get_update_count(self):
        try:
            return self.online_model.t_
        except:
            return 0

class SimplePreprocessor:
    """Minimal preprocessor for your existing system"""
    
    def __init__(self):
        # Load your existing preprocessing objects
        self.ct = joblib.load("models/column_transformer.pkl")  # Save this during training!
        self.sc = joblib.load("models/scaler.pkl")  # Save this during training!
        
    def prepare_customer(self, arrival_hour, queue_length, service_type, service_details):
        
        import pandas as pd
        df = pd.DataFrame({
            'arrival_hour': [arrival_hour],
            'queue_length': [queue_length], 
            'service_type': [service_type],
            'service_details': [service_details],
            'avg_service_time': [20.0],  
            'hourly_avg_service_time': [18.0]  
        })
        
        
        X_encoded = self.ct.transform(df)
        X_scaled = X_encoded.copy()
        X_scaled[:, 9:] = self.sc.transform(X_scaled[:, 9:])
        
        return X_scaled
    


class ModelManager:
    def __init__(self):
        self.business_models = {}
        self.preprocessor = SimplePreprocessor()  # ADD THIS
    
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
    
    # ADD THIS NEW METHOD:
    def predict_from_customer_input(self, business_id, arrival_hour, queue_length, service_type, service_details):
     
        X_ready = self.preprocessor.prepare_customer(
            arrival_hour, queue_length, service_type, service_details
        )
        
        # Use existing prediction logic
        return self.get_prediction(business_id, X_ready)
    

    
manager = ModelManager()
preprocessor = SimplePreprocessor()


arrival_hour = 14  
queue_length = 3
service_type = "barber"
service_details = "haircut"


X_ready = preprocessor.prepare_customer(arrival_hour, queue_length, service_type, service_details)


prediction = manager.get_prediction("Barber_1", X_ready)
print(f"Wait time: {prediction[0]:.1f} minutes")