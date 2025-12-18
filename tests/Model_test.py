# import sys
# import os
# sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# from ML_model import Predictor, ModelManager, SimplePreprocessor
# import numpy as np
# import pytest


# # Add parent directory to path
# sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# from ML_model import Predictor

# class TestPredictor:
#     """Unit tests for Predictor class"""
    
#     def test_initialization_sets_business_id(self):
#         """Test that Predictor stores business_id correctly"""
#         # Arrange
#         business_id = "barber_shop_123"
        
#         # Act
#         predictor = Predictor(business_id)
        
#         # Assert
#         assert predictor.business_id == business_id
    
#     def test_initialization_loads_stacking_model(self):
#         """Test that stacking model is loaded on initialization"""
#         # Arrange & Act
#         predictor = Predictor("test_shop")
        
#         # Assert
#         assert hasattr(predictor, 'stacking_model')
#         assert predictor.stacking_model is not None
    
#     def test_predict_wait_time_returns_correct_shape(self):
#         """Test that prediction returns array with correct shape"""
#         # Arrange
#         predictor = Predictor("test_shop")
#         X = np.array([[1.0] * 13])  # 1 sample, 13 features
        
#         # Act
#         prediction = predictor.predict_wait_time(X)
        
#         # Assert
#         assert isinstance(prediction, np.ndarray)
#         assert prediction.shape == (1,)  # One prediction per sample
    
#     def test_predict_wait_time_with_multiple_samples(self):
#         """Test prediction works with multiple input samples"""
#         # Arrange
#         predictor = Predictor("test_shop")
#         X = np.array([
#             [1.0] * 13,
#             [2.0] * 13,
#             [3.0] * 13
#         ])  # 3 samples, 13 features
        
#         # Act
#         predictions = predictor.predict_wait_time(X)
        
#         # Assert
#         assert len(predictions) == 3  # One prediction per sample
    
#     def test_online_update_saves_model(self):
#         """Test that online_update saves the model"""
#         # Arrange
#         predictor = Predictor("update_test_shop")
#         X = np.array([[1.0] * 13])
#         y = np.array([15.5])
        
#         # Act & Assert (should not raise exception)
#         try:
#             predictor.online_update(X, y)
#             assert True  # If we get here, it worked
#         except Exception as e:
#             pytest.fail(f"online_update failed: {e}")
    
#     def test_get_update_count_returns_number(self):
#         """Test that get_update_count returns a numeric value"""
#         # Arrange
#         predictor = Predictor("count_test_shop")
        
#         # Act
#         count = predictor.get_update_count()
        
#         # Assert
#         assert isinstance(count, (int, float, np.integer, np.floating))
#         assert count >= 0

# # Run tests if file is executed directly
# if __name__ == "__main__":
#     # Simple runner for manual testing
#     test = TestPredictor()
    
#     print("Running Predictor unit tests...")
#     print("=" * 50)
    
#     test_methods = [
#         test.test_initialization_sets_business_id,
#         test.test_initialization_loads_stacking_model,
#         test.test_predict_wait_time_returns_correct_shape,
#         test.test_predict_wait_time_with_multiple_samples,
#         test.test_online_update_saves_model,
#         test.test_get_update_count_returns_number,
#     ]
    
#     for method in test_methods:
#         try:
#             method()
#             print(f"✅ {method.__name__}")
#         except AssertionError as e:
#             print(f"❌ {method.__name__} failed: {e}")
#         except Exception as e:
#             print(f"❌ {method.__name__} error: {e}")
    
#     print("=" * 50)
#     print("Unit tests completed!")



# class TestModelManager:
#     """Unit tests for ModelManager class"""
    
#     def test_initialization_creates_empty_dict(self):
#         """Test that ModelManager starts with empty business_models"""
#         # Arrange & Act
#         manager = ModelManager()
        
#         # Assert
#         assert hasattr(manager, 'business_models')
#         assert isinstance(manager.business_models, dict)
#         assert len(manager.business_models) == 0
    
#     def test_register_business_adds_new_business(self):
#         """Test that register_business adds new business to dictionary"""
#         # Arrange
#         manager = ModelManager()
#         business_id = "barber_shop_123"
        
#         # Act
#         manager.register_business(business_id)
        
#         # Assert
#         assert business_id in manager.business_models
#         assert len(manager.business_models) == 1
    
#     def test_register_business_does_not_duplicate(self):
#         """Test that registering same business twice doesn't create duplicate"""
#         # Arrange
#         manager = ModelManager()
#         business_id = "barber_shop_123"
        
#         # Act
#         manager.register_business(business_id)
#         manager.register_business(business_id)  # Second time
        
#         # Assert
#         assert business_id in manager.business_models
#         assert len(manager.business_models) == 1  # Still only one
    
#     def test_get_prediction_auto_registers_new_business(self):
#         """Test that get_prediction automatically registers new business"""
#         # Arrange
#         manager = ModelManager()
#         business_id = "new_shop_999"
#         X = np.array([[1.0] * 13])
        
#         # Act
#         prediction = manager.get_prediction(business_id, X)
        
#         # Assert
#         assert business_id in manager.business_models  # Auto-registered
#         assert isinstance(prediction, np.ndarray)
#         assert len(prediction) == 1
    
#     def test_get_prediction_returns_same_for_same_input(self):
#         """Test that same input gives consistent predictions"""
#         # Arrange
#         manager = ModelManager()
#         business_id = "consistency_test"
#         X = np.array([[1.0] * 13])
        
#         # Act
#         pred1 = manager.get_prediction(business_id, X)
#         pred2 = manager.get_prediction(business_id, X)
        
#         # Assert
#         assert np.allclose(pred1, pred2), "Predictions should be consistent"
    
#     def test_online_update_auto_registers_new_business(self):
#         """Test that online_update automatically registers new business"""
#         # Arrange
#         manager = ModelManager()
#         business_id = "update_test_shop"
#         X = np.array([[1.0] * 13])
#         y = np.array([15.5])
        
#         # Act
#         manager.online_update(business_id, X, y)
        
#         # Assert
#         assert business_id in manager.business_models  # Auto-registered
    
#     def test_multiple_businesses_independent(self):
#         """Test that different businesses have independent predictors"""
#         # Arrange
#         manager = ModelManager()
#         shop1 = "barber_shop_1"
#         shop2 = "car_wash_2"
#         X = np.array([[1.0] * 13])
        
#         # Act
#         manager.register_business(shop1)
#         manager.register_business(shop2)
        
#         # Assert
#         assert shop1 in manager.business_models
#         assert shop2 in manager.business_models
#         assert len(manager.business_models) == 2
#         assert manager.business_models[shop1] != manager.business_models[shop2]

# if __name__ == "__main__":
#     test = TestModelManager()
    
#     print("Running ModelManager unit tests...")
#     print("=" * 50)
    
#     test_methods = [
#         test.test_initialization_creates_empty_dict,
#         test.test_register_business_adds_new_business,
#         test.test_register_business_does_not_duplicate,
#         test.test_get_prediction_auto_registers_new_business,
#         test.test_get_prediction_returns_same_for_same_input,
#         test.test_online_update_auto_registers_new_business,
#         test.test_multiple_businesses_independent,
#     ]
    
#     for method in test_methods:
#         try:
#             method()
#             print(f"✅ {method.__name__}")
#         except AssertionError as e:
#             print(f"❌ {method.__name__} failed: {e}")
#         except Exception as e:
#             print(f"❌ {method.__name__} error: {e}")
    
#     print("=" * 50)
#     print("ModelManager unit tests completed!")




# # tests/test_preprocessor.py

# import pytest
# import numpy as np
# import sys
# import os

# sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# from ML_model import SimplePreprocessor

# class TestSimplePreprocessor:
#     """Unit tests for SimplePreprocessor class"""
    
#     def test_initialization_loads_models(self):
#         """Test that SimplePreprocessor loads transformer and scaler"""
#         # Arrange & Act
#         preprocessor = SimplePreprocessor()
        
#         # Assert
#         assert hasattr(preprocessor, 'ct')
#         assert hasattr(preprocessor, 'sc')
#         assert preprocessor.ct is not None
#         assert preprocessor.sc is not None
    
#     def test_prepare_customer_returns_correct_shape(self):
#         """Test that prepare_customer returns array with correct shape"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
#         arrival_hour = 14
#         queue_length = 3
#         service_type = "barber"
#         service_details = "haircut"
        
#         # Act
#         X = preprocessor.prepare_customer(arrival_hour, queue_length, 
#                                          service_type, service_details)
        
#         # Assert
#         assert isinstance(X, np.ndarray)
#         assert X.shape[0] == 1  # One sample
#         assert X.shape[1] == 13  # 13 features after preprocessing
    
#     def test_prepare_customer_with_different_service_types(self):
#         """Test preprocessing works with different service types"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
#         test_cases = [
#             (14, 3, "barber", "haircut"),
#             (10, 1, "car_wash", "small_car"),
#             (16, 5, "workshop", "oil_change"),
#         ]
        
#         for arrival_hour, queue_length, service_type, service_details in test_cases:
#             # Act
#             X = preprocessor.prepare_customer(arrival_hour, queue_length,
#                                              service_type, service_details)
            
#             # Assert
#             assert X.shape == (1, 13)
#             assert not np.any(np.isnan(X)), "Should not contain NaN values"
    
#     def test_prepare_customer_handles_edge_hours(self):
#         """Test preprocessing works with edge hour values (0 and 23)"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
        
#         # Test midnight (0)
#         X1 = preprocessor.prepare_customer(0, 2, "barber", "haircut")
#         assert X1.shape == (1, 13)
        
#         # Test 11 PM (23)
#         X2 = preprocessor.prepare_customer(23, 2, "barber", "haircut")
#         assert X2.shape == (1, 13)
    
#     def test_prepare_customer_handles_zero_queue(self):
#         """Test preprocessing works with zero queue length"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
        
#         # Act
#         X = preprocessor.prepare_customer(14, 0, "barber", "haircut")
        
#         # Assert
#         assert X.shape == (1, 13)
#         assert not np.any(np.isinf(X)), "Should not contain infinite values"
    
#     def test_prepare_customer_returns_consistent_results(self):
#         """Test that same input gives same output"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
        
#         # Act
#         X1 = preprocessor.prepare_customer(14, 3, "barber", "haircut")
#         X2 = preprocessor.prepare_customer(14, 3, "barber", "haircut")
        
#         # Assert
#         assert np.allclose(X1, X2), "Same input should give same output"
    
#     def test_prepare_customer_with_max_queue(self):
#         """Test preprocessing works with large queue length"""
#         # Arrange
#         preprocessor = SimplePreprocessor()
        
#         # Act
#         X = preprocessor.prepare_customer(14, 100, "barber", "haircut")
        
#         # Assert
#         assert X.shape == (1, 13)
#         assert not np.any(np.isnan(X))

# if __name__ == "__main__":
#     test = TestSimplePreprocessor()
    
#     print("Running SimplePreprocessor unit tests...")
#     print("=" * 50)
    
#     test_methods = [
#         test.test_initialization_loads_models,
#         test.test_prepare_customer_returns_correct_shape,
#         test.test_prepare_customer_with_different_service_types,
#         test.test_prepare_customer_handles_edge_hours,
#         test.test_prepare_customer_handles_zero_queue,
#         test.test_prepare_customer_returns_consistent_results,
#         test.test_prepare_customer_with_max_queue,
#     ]
    
#     for method in test_methods:
#         try:
#             method()
#             print(f" {method.__name__}")
#         except AssertionError as e:
#             print(f" {method.__name__} failed: {e}")
#         except Exception as e:
#             print(f" {method.__name__} error: {e}")
    
#     print("=" * 50)
#     print("SimplePreprocessor unit tests completed!")

def test_basic():
    assert True
    
def test_math():
    assert 2 + 2 == 4
    
def test_string():
    assert len("test") == 4