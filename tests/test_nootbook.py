# import pandas as pd
# import pytest
# from sklearn.metrics import mean_absolute_error
# from sklearn.model_selection import train_test_split
# from backend.clean_data import remove_duplicates, check_missing_values, convert_datetime_columns, find_extreme_wait_times
# from backend.ml_model import prepare_features, train_linear_model, train_online_model, daily_learning

# class TestCleanData:
    
#     def test_remove_duplicates(self):
#         duplicate_data = pd.DataFrame({
#             'arrival_time': ['15-12-2024 14.30', '15-12-2024 14.30', '16-12-2024 09.15'],
#             'start_time': ['15-12-2024 14.45', '15-12-2024 14.45', '16-12-2024 09.30'],
#             'finish_time': ['15-12-2024 15.00', '15-12-2024 15.00', '16-12-2024 09.50'],
#             'wait_time': [15, 15, 15],
#             'customer_id': [1, 1, 2]
#         })
        
#         result = remove_duplicates(duplicate_data)
        
#         assert len(result) == 2
#         assert result['customer_id'].nunique() == 2

#     def test_check_missing_values(self):
#         test_data = pd.DataFrame({
#             'arrival_time': ['15-12-2024 14.30', None, '16-12-2024 09.15'],
#             'start_time': ['15-12-2024 14.45', '15-12-2024 14.45', None],
#             'finish_time': ['15-12-2024 15.00', '15-12-2024 15.00', '16-12-2024 09.50'],
#             'wait_time': [15, None, 20],
#             'queue_length': [5, 8, 12]
#         })
        
#         result = check_missing_values(test_data)
        
#         assert result['arrival_time'] == 1
#         assert result['start_time'] == 1
#         assert result['wait_time'] == 1
#         assert result['finish_time'] == 0
#         assert result['queue_length'] == 0

#     def test_convert_datetime_columns(self):
#         test_data = pd.DataFrame({
#             'arrival_time': ['30-03-2023 0.10', '30-03-2023 1.58'],
#             'start_time': ['30-03-2023 0.16', '30-03-2023 2.04'],
#             'finish_time': ['2023-03-30 00:25:53.200000000', '2023-03-30 02:16:49.000000000'],
#             'wait_time': [9.82, 12.20],
#             'queue_length': [28, 27]
#         })
        
#         result = convert_datetime_columns(test_data)
        
#         assert result['arrival_time'].dtype == result['start_time'].dtype
#         assert result['start_time'].dtype == result['finish_time'].dtype
#         assert result['arrival_time'].dtype == result['finish_time'].dtype

#     def test_find_extreme_wait_times(self):
#         test_data = pd.DataFrame({
#             'arrival_time': ['30-03-2023 0.10', '30-03-2023 1.58', '30-03-2023 6.51', '30-03-2023 8.00'],
#             'start_time': ['30-03-2023 0.16', '30-03-2023 2.04', '30-03-2023 6.58', '30-03-2023 12.15'],
#             'finish_time': ['2023-03-30 00:25:53.200000000', '2023-03-30 02:16:49.000000000', '2023-03-30 07:25:38.800000000', '2023-03-30 12:45:00.000000000'],
#             'wait_time': [9.82, 12.20, 6.85, 255.0],  # 255 minutes = 4 hours 15 minutes
#             'queue_length': [28, 27, 24, 50]
#         })
        
#         stats, extreme_count = find_extreme_wait_times(test_data, threshold=240)  # 240 minutes = 4 hours
        
#         assert extreme_count == 1
#         assert stats['max'] == 255.0
#         assert stats['min'] == 6.85
#         assert stats['mean'] > 0


# class TestMLModel:
    
#     def test_prepare_features_returns_correct_columns(self):
        
#         test_data = pd.DataFrame({
#             'arrival_time': pd.to_datetime(['2024-01-01 14:30:00']),
#             'queue_length': [5],
#             'wait_time': [15]
#         })
        
        
#         X, y = prepare_features(test_data)
        
        
#         assert list(X.columns) == ['arrival_hour', 'arrival_day', 'queue_length']
#         assert y.name == 'wait_time'
    
#     def test_prepare_features_calculates_time_correctly(self):
        
#         test_data = pd.DataFrame({
#             'arrival_time': pd.to_datetime(['2024-01-01 14:30:00']),  
#             'queue_length': [5],
#             'wait_time': [15]
#         })
        
        
#         X, y = prepare_features(test_data)
        
        
#         assert X.iloc[0]['arrival_hour'] == 14
#         assert X.iloc[0]['arrival_day'] == 0
    
#     def test_train_linear_model_returns_model_and_error(self):
#         X_train = pd.DataFrame({
#             'arrival_hour': [9, 14, 18],
#             'arrival_day': [0, 2, 4],
#             'queue_length': [3, 8, 12]
#         })
#         y_train = pd.Series([10, 25, 40])
#         X_test = pd.DataFrame({
#             'arrival_hour': [11, 16],
#             'arrival_day': [1, 3],
#             'queue_length': [5, 9]
#         })
#         y_test = pd.Series([15, 30])
        
#         model, error = train_linear_model(X_train, y_train, X_test, y_test)
        
#         assert model is not None
#         assert hasattr(model, 'predict')
#         assert error >= 0
#         assert isinstance(error, float)    

#     def test_train_online_model_returns_model_and_error(self):
#         X_train = pd.DataFrame({
#             'arrival_hour': [9, 14, 18, 10, 15],
#             'arrival_day': [0, 2, 4, 1, 3],
#             'queue_length': [3, 8, 12, 4, 7]
#         })
#         y_train = pd.Series([10, 25, 40, 15, 20])
#         X_test = pd.DataFrame({
#             'arrival_hour': [11, 16],
#             'arrival_day': [1, 3],
#             'queue_length': [5, 9]
#         })
#         y_test = pd.Series([15, 30])
        
#         model, error = train_online_model(X_train, y_train, X_test, y_test)
        
#         assert model is not None
#         assert hasattr(model, 'predict')
#         assert hasattr(model, 'partial_fit')
#         assert error >= 0
#         assert isinstance(error, float)    

#     def test_daily_learning_returns_daily_results(self):
#         data = pd.DataFrame({
#             'arrival_time': pd.to_datetime([
#                 '2024-01-01 09:00:00', '2024-01-01 10:00:00', '2024-01-01 11:00:00',
#                 '2024-01-01 12:00:00', '2024-01-01 13:00:00', '2024-01-01 14:00:00',
#                 '2024-01-01 15:00:00', '2024-01-01 16:00:00', '2024-01-01 17:00:00',
#                 '2024-01-01 18:00:00', '2024-01-01 19:00:00',  # Day 1 - 11 customers (>10)
#                 '2024-01-02 09:00:00', '2024-01-02 10:00:00', '2024-01-02 11:00:00',
#                 '2024-01-02 12:00:00', '2024-01-02 13:00:00', '2024-01-02 14:00:00',
#                 '2024-01-02 15:00:00', '2024-01-02 16:00:00', '2024-01-02 17:00:00',
#                 '2024-01-02 18:00:00', '2024-01-02 19:00:00'   # Day 2 - 11 customers (>10)
#             ]),
#             'queue_length': [3, 5, 7, 4, 6, 8, 5, 7, 9, 6, 8, 2, 4, 6, 3, 5, 7, 4, 6, 8, 5, 7],
#             'wait_time': [10, 15, 20, 12, 18, 25, 14, 19, 30, 16, 22, 8, 12, 18, 9, 13, 20, 10, 15, 23, 11, 17]
#         })
        
#         X, y = prepare_features(data)
#         X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
#         online_model, _ = train_online_model(X_train, y_train, X_test, y_test)
        
#         daily_results = daily_learning(data, online_model, X, y)
        
#         assert isinstance(daily_results, list)
#         assert len(daily_results) == 2  # Both days should be processed (>10 samples each)
#         assert 'day' in daily_results[0]
#         assert 'error' in daily_results[0]
#         assert 'samples' in daily_results[0]
#         assert daily_results[0]['samples'] == 11  # Day 1 has 11 customers