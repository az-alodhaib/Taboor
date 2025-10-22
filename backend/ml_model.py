from sklearn.linear_model import LinearRegression, PassiveAggressiveRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
import pandas as pd

def prepare_features(data):
    
    data['arrival_hour'] = data['arrival_time'].dt.hour
    data['arrival_day'] = data['arrival_time'].dt.dayofweek
    X = data[['arrival_hour', 'arrival_day', 'queue_length']]
    y = data['wait_time']
    return X, y

def train_linear_model(X_train, y_train, X_test, y_test):
    
    model = LinearRegression()
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    error = mean_absolute_error(y_test, predictions)
    return model, error

def train_online_model(X_train, y_train, X_test, y_test):
    
    model = PassiveAggressiveRegressor(random_state=42)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    error = mean_absolute_error(y_test, predictions)
    return model, error

def daily_learning(data, online_model, X, y):
    
    unique_days = sorted(data['arrival_time'].dt.date.unique())
    daily_results = []

    for day in unique_days:
        day_mask = data['arrival_time'].dt.date == day
        X_day = X[day_mask]
        y_day = y[day_mask]
        
        if len(X_day) > 10:  
            online_model.partial_fit(X_day, y_day)
            predictions = online_model.predict(X_day)
            error = mean_absolute_error(y_day, predictions)
            
            daily_results.append({
                'day': day,
                'error': error,
                'samples': len(X_day)
            })
    
    return daily_results

