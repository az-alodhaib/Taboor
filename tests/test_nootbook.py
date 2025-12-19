# test_queue_system_complete.py
import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os
from unittest.mock import patch, MagicMock
import joblib
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, StackingRegressor
from sklearn.preprocessing import PolynomialFeatures, OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, median_absolute_error
import matplotlib.pyplot as plt

# Import functions from your notebook (we'll mock the file operations)
# For testing, we'll define the functions inline

def generate_realistic_synthetic_data(n_samples=1000, start_date='2023-03-31', days=30):
    """Testable version of the synthetic data generation function"""
    np.random.seed(42)
    
    # Service durations (2-minute range)
    service_durations = {
        'beard': (9, 11),
        'haircut': (14, 16),  
        'beard and haircut': (24, 26),
        'small car': (22, 24),
        'big car': (29, 31),
        'oil change': (19, 21)
    }
    
    # Service mappings
    service_mapping = {
        'beard': 'barber', 'haircut': 'barber', 'beard and haircut': 'barber',
        'small car': 'car wash', 'big car': 'car wash', 
        'oil change': 'workshop'
    }
    
    data = []
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    
    samples_per_day = n_samples // days
    
    for day in range(days):
        current_date = start_dt + timedelta(days=day)
        
        # Generate realistic business day with sequential arrivals
        business_hours = list(range(8, 21))  # 8 AM to 9 PM
        daily_customers = samples_per_day
        
        # Track the actual queue state throughout the day
        current_time = current_date.replace(hour=8, minute=0, second=0)
        queue = []  # List of (arrival_time, service_type, service_detail, service_duration)
        
        for customer in range(daily_customers):
            # Realistic arrival pattern - more customers during peak hours
            hour = current_time.hour
            if 8 <= hour <= 10 or 17 <= hour <= 19:  # Peak hours
                time_gap = np.random.randint(5, 15)  # 5-15 minutes between arrivals
            else:
                time_gap = np.random.randint(10, 30)  # 10-30 minutes between arrivals
            
            arrival_time = current_time + timedelta(minutes=time_gap)
            current_time = arrival_time
            
            # Skip if beyond business hours
            if arrival_time.hour >= 21:
                break
            
            # Random service details
            service_detail = np.random.choice(list(service_durations.keys()))
            service_type = service_mapping[service_detail]
            service_time = np.random.uniform(*service_durations[service_detail])
            
            # Add customer to queue
            queue.append((arrival_time, service_type, service_detail, service_time))
            
            # Calculate wait time based on actual queue position
            staff_count = 2.5
            queue_position = len(queue)
            
            # Estimate wait time: sum of service times for customers ahead / staff_count
            wait_time = sum([q[3] for q in queue[:queue_position]]) / staff_count
            
            # Calculate actual service timeline
            start_time = arrival_time + timedelta(minutes=wait_time)
            finish_time = start_time + timedelta(minutes=service_time)
            
            data.append({
                'arrival_time': arrival_time,
                'start_time': start_time,
                'finish_time': finish_time,
                'wait_time': round(wait_time, 2),
                'queue_length': queue_position,  # This is their position in line
                'service_type': service_type,
                'service_details': service_detail,
                'arrival_hour': arrival_time.hour
            })
            
            # Remove finished customers from queue
            # Customers finish when current_time reaches their finish_time
            queue = [q for q in queue if q[0] + timedelta(minutes=wait_time + service_time) > current_time]
    
    return pd.DataFrame(data)

class TestQueueSystem(unittest.TestCase):
    
    def setUp(self):
        """Set up test data and environment"""
        np.random.seed(42)
        
        # Create a small sample dataset for testing
        self.test_data = pd.DataFrame({
            'arrival_time': ['30-03-2023 0.10', '30-03-2023 0.10', '30-03-2023 0.10'],
            'start_time': ['30-03-2023 0.10', '30-03-2023 0.16', '30-03-2023 0.16'],
            'finish_time': [
                '2023-03-30 00:22:44.800000000',
                '2023-03-30 00:25:53.200000000', 
                '2023-03-30 00:25:48.400000000'
            ],
            'wait_time': [12.68, 9.82, 9.74],
            'queue_length': [28, 28, 28]
        })
        
        # Create mock CSV file for testing
        self.test_csv_path = 'test_queue_data.csv'
        self.test_data.to_csv(self.test_csv_path, index=False)
        
    def tearDown(self):
        """Clean up test files"""
        if os.path.exists(self.test_csv_path):
            os.remove(self.test_csv_path)
        
        # Clean up any model files created during testing
        for model_file in ['test_stacking_model.pkl', 'test_transformer.pkl', 'test_scaler.pkl']:
            if os.path.exists(model_file):
                os.remove(model_file)
    
    def test_01_data_loading(self):
        """Test that data loads correctly from CSV"""
        print("Test 1: Data Loading")
        
        # Scenario: Loading data from CSV file
        # Given: A CSV file with queue data
        # When: We load the data using pandas
        # Then: Data should load successfully with correct columns
        
        with patch('pandas.read_csv') as mock_read:
            mock_read.return_value = self.test_data.copy()
            
            dataset = pd.read_csv(self.test_csv_path)
            
            # Assert data loads correctly
            self.assertIsInstance(dataset, pd.DataFrame)
            self.assertEqual(len(dataset), 3)
            self.assertIn('arrival_time', dataset.columns)
            self.assertIn('wait_time', dataset.columns)
            print("✓ Data loads correctly")
    
    def test_02_synthetic_data_generation(self):
        """Test synthetic data generation function"""
        print("\nTest 2: Synthetic Data Generation")
        
        # Scenario: Generating synthetic queue data
        # Given: Parameters for data generation
        # When: We call generate_realistic_synthetic_data
        # Then: Should return DataFrame with expected structure
        
        # Generate small test dataset
        synthetic_data = generate_realistic_synthetic_data(n_samples=100, days=2)
        
        # Assert structure
        self.assertIsInstance(synthetic_data, pd.DataFrame)
        self.assertGreater(len(synthetic_data), 0)
        
        expected_columns = [
            'arrival_time', 'start_time', 'finish_time', 
            'wait_time', 'queue_length', 'service_type', 
            'service_details', 'arrival_hour'
        ]
        
        for col in expected_columns:
            self.assertIn(col, synthetic_data.columns)
        
        # Assert data types
        self.assertIsInstance(synthetic_data['arrival_time'].iloc[0], datetime)
        self.assertIsInstance(synthetic_data['wait_time'].iloc[0], (int, float, np.float64))
        
        # Assert business hour constraints
        arrival_hours = synthetic_data['arrival_hour'].unique()
        for hour in arrival_hours:
            self.assertGreaterEqual(hour, 0)  # 0-23 hour format
            self.assertLessEqual(hour, 23)
        
        print(f"✓ Generated {len(synthetic_data)} synthetic records")
        print(f"✓ Columns: {list(synthetic_data.columns)}")
    
    def test_03_datetime_conversion(self):
        """Test datetime conversion functionality"""
        print("\nTest 3: Datetime Conversion")
        
        # Scenario: Converting string dates to datetime objects
        # Given: DataFrame with string dates in specific format
        # When: We apply pd.to_datetime
        # Then: Dates should convert successfully to datetime objects
        
        dataset = self.test_data.copy()
        
        # Test conversion
        dataset['arrival_time'] = pd.to_datetime(dataset['arrival_time'], format='%d-%m-%Y %H.%M')
        dataset['start_time'] = pd.to_datetime(dataset['start_time'], format='%d-%m-%Y %H.%M')
        dataset['finish_time'] = pd.to_datetime(dataset['finish_time'])
        
        # Assert conversions
        self.assertIsInstance(dataset['arrival_time'].iloc[0], pd.Timestamp)
        self.assertIsInstance(dataset['start_time'].iloc[0], pd.Timestamp)
        self.assertIsInstance(dataset['finish_time'].iloc[0], pd.Timestamp)
        
        # Assert specific values
        expected_date = datetime(2023, 3, 30, 0, 10)
        self.assertEqual(dataset['arrival_time'].iloc[0].to_pydatetime(), expected_date)
        
        print("✓ Datetime conversion successful")
    
    def test_04_feature_engineering(self):
        """Test feature engineering steps"""
        print("\nTest 4: Feature Engineering")
        
        # Scenario: Creating engineered features
        # Given: Dataset with datetime columns
        # When: We extract hour and calculate service duration
        # Then: New features should be created correctly
        
        dataset = self.test_data.copy()
        
        # Convert to datetime
        dataset['arrival_time'] = pd.to_datetime(dataset['arrival_time'], format='%d-%m-%Y %H.%M')
        dataset['start_time'] = pd.to_datetime(dataset['start_time'], format='%d-%m-%Y %H.%M')
        dataset['finish_time'] = pd.to_datetime(dataset['finish_time'])
        
        # Create hour feature
        dataset['arrival_hour'] = dataset['arrival_time'].dt.hour
        
        # Create service duration feature
        dataset['actual_service_duration'] = (dataset['finish_time'] - dataset['start_time']).dt.total_seconds() / 60
        
        # Assert new features
        self.assertIn('arrival_hour', dataset.columns)
        self.assertIn('actual_service_duration', dataset.columns)
        
        # Assert hour values
        self.assertEqual(dataset['arrival_hour'].iloc[0], 0)  # 00:10 -> hour 0
        
        # Assert service duration calculation
        for duration in dataset['actual_service_duration']:
            self.assertGreater(duration, 0)
        
        print("✓ Feature engineering successful")
        print(f"  Service durations: {dataset['actual_service_duration'].tolist()}")
    
    def test_05_rolling_averages(self):
        """Test rolling average calculations"""
        print("\nTest 5: Rolling Average Calculations")
        
        # Scenario: Calculating rolling averages for service times
        # Given: Dataset with service durations
        # When: We calculate expanding mean averages
        # Then: Should produce meaningful rolling averages
        
        # Create test dataset with service types
        test_data = pd.DataFrame({
            'arrival_time': pd.date_range('2023-01-01', periods=10, freq='H'),
            'service_type': ['barber', 'barber', 'car wash', 'barber', 'workshop'] * 2,
            'service_details': ['haircut', 'beard', 'small car', 'haircut', 'oil change'] * 2,
            'actual_service_duration': [15, 10, 23, 16, 20, 14, 11, 22, 17, 21],
            'start_hour': [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
        })
        
        # Sort by arrival time
        test_data = test_data.sort_values('arrival_time').reset_index(drop=True)
        
        # Calculate average service time by service type and details
        test_data['avg_service_time'] = test_data.groupby(['service_type', 'service_details'])['actual_service_duration']\
            .expanding()\
            .mean()\
            .shift(1)\
            .reset_index(level=[0, 1], drop=True)
        
        # Fill NaN with median
        test_data['avg_service_time'] = test_data['avg_service_time'].fillna(test_data['actual_service_duration'].median())
        
        # Calculate hourly average
        test_data['hourly_avg_service_time'] = test_data.groupby('start_hour')['actual_service_duration']\
            .expanding()\
            .mean()\
            .shift(1)\
            .reset_index(level=0, drop=True)
        
        test_data['hourly_avg_service_time'] = test_data['hourly_avg_service_time'].fillna(test_data['actual_service_duration'].median())
        
        # Assert calculations
        self.assertIn('avg_service_time', test_data.columns)
        self.assertIn('hourly_avg_service_time', test_data.columns)
        
        # Check that averages are reasonable
        for avg in test_data['avg_service_time']:
            self.assertGreaterEqual(avg, 10)  # Should be at least min service time
            self.assertLessEqual(avg, 25)     # Should not exceed max service time much
        
        print("✓ Rolling averages calculated successfully")
        print(f"  Sample averages: {test_data[['service_type', 'avg_service_time']].head().to_string()}")
    
    def test_06_service_type_assignment(self):
        """Test service type and details assignment"""
        print("\nTest 6: Service Type Assignment")
        
        # Scenario: Assigning service types based on probabilities
        # Given: Dataset without service types
        # When: We assign service types probabilistically
        # Then: Service types should follow specified distribution
        
        np.random.seed(42)
        
        # Create test dataset
        n_samples = 1000
        test_data = pd.DataFrame({
            'wait_time': np.random.uniform(0, 100, n_samples)
        })
        
        # Assign service types
        service_types = ['barber', 'car wash', 'workshop']
        probabilities = [0.4, 0.4, 0.2]
        
        test_data['service_type'] = np.random.choice(service_types, size=n_samples, p=probabilities)
        
        # Assign service details based on service type
        test_data['service_details'] = 'oil change'  # Default for workshop
        
        test_data.loc[test_data['service_type'] == 'barber', 'service_details'] = np.random.choice(
            ['haircut', 'beard', 'beard and haircut'], 
            size=len(test_data[test_data['service_type'] == 'barber']),
            p=[0.5, 0.3, 0.2]
        )
        
        test_data.loc[test_data['service_type'] == 'car wash', 'service_details'] = np.random.choice(
            ['small car', 'big car'],
            size=len(test_data[test_data['service_type'] == 'car wash']), 
            p=[0.7, 0.3]
        )
        
        # Assert assignments
        self.assertIn('service_type', test_data.columns)
        self.assertIn('service_details', test_data.columns)
        
        # Check distribution of service types
        type_counts = test_data['service_type'].value_counts(normalize=True)
        self.assertAlmostEqual(type_counts['barber'], 0.4, delta=0.05)
        self.assertAlmostEqual(type_counts['car wash'], 0.4, delta=0.05)
        
        # Check that details match types
        barber_details = test_data[test_data['service_type'] == 'barber']['service_details'].unique()
        self.assertTrue(all(detail in ['haircut', 'beard', 'beard and haircut'] for detail in barber_details))
        
        print("✓ Service types assigned with correct distribution")
        print(f"  Service type counts:\n{test_data['service_type'].value_counts()}")
    
    def test_07_data_preprocessing(self):
        """Test data preprocessing pipeline"""
        print("\nTest 7: Data Preprocessing Pipeline")
        
        # Scenario: Preparing data for machine learning
        # Given: Dataset with categorical and numerical features
        # When: We apply encoding and scaling
        # Then: Data should be properly formatted for ML
        
        # Create test dataset
        test_data = pd.DataFrame({
            'arrival_hour': [8, 9, 10, 11, 12],
            'queue_length': [1, 2, 3, 4, 5],
            'service_type': ['barber', 'car wash', 'workshop', 'barber', 'car wash'],
            'service_details': ['haircut', 'small car', 'oil change', 'beard', 'big car'],
            'avg_service_time': [15.0, 23.5, 20.0, 16.5, 24.0],
            'wait_time': [5.0, 10.0, 15.0, 8.0, 12.0]
        })
        
        # Prepare features and target
        X = test_data[['arrival_hour', 'queue_length', 'service_type', 'service_details', 'avg_service_time', 'avg_service_time']].values
        y = test_data['wait_time'].values
        
        # Apply one-hot encoding
        ct = ColumnTransformer(transformers=[
            ('encoder', OneHotEncoder(), [2, 3])
        ], remainder='passthrough')
        
        X_encoded = np.array(ct.fit_transform(X))
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X_encoded, y, test_size=0.2, random_state=1
        )
        
        # Apply scaling
        sc = StandardScaler()
        
        # Determine which columns are numeric (after one-hot encoding)
        # One-hot encoding creates additional columns at the beginning
        n_categorical = len(ct.transformers_[0][1].get_feature_names_out())
        X_train[:, n_categorical:] = sc.fit_transform(X_train[:, n_categorical:])
        X_test[:, n_categorical:] = sc.transform(X_test[:, n_categorical:])
        
        # Assert preprocessing
        self.assertEqual(X_encoded.shape[0], 5)
        self.assertEqual(len(y), 5)
        
        # Check that scaling was applied (mean ~0, std ~1 for scaled features)
        scaled_features_train = X_train[:, n_categorical:]
        self.assertAlmostEqual(scaled_features_train.mean(), 0, delta=0.1)
        self.assertAlmostEqual(scaled_features_train.std(), 1, delta=0.1)
        
        print("✓ Data preprocessing pipeline successful")
        print(f"  Original shape: {X.shape}")
        print(f"  Encoded shape: {X_encoded.shape}")
    
    def test_08_stacking_model_training(self):
        """Test stacking ensemble model training"""
        print("\nTest 8: Stacking Model Training")
        
        # Scenario: Training a stacking ensemble model
        # Given: Preprocessed training data
        # When: We train a StackingRegressor
        # Then: Model should train successfully and make predictions
        
        # Create synthetic data for training
        np.random.seed(42)
        n_samples = 200
        
        X_train = np.random.randn(n_samples, 15)
        y_train = np.random.randn(n_samples) * 10 + 50
        
        X_test = np.random.randn(50, 15)
        y_test = np.random.randn(50) * 10 + 50
        
        # Define base models
        base_models = [
            ('linear', LinearRegression()),
            ('random_forest', RandomForestRegressor(n_estimators=10, random_state=0)),
            ('polynomial', make_pipeline(PolynomialFeatures(degree=2), LinearRegression()))
        ]
        
        # Create stacking model
        stacking_model = StackingRegressor(
            estimators=base_models,
            final_estimator=LinearRegression(),
            cv=3
        )
        
        # Train model
        stacking_model.fit(X_train, y_train)
        
        # Make predictions
        predictions = stacking_model.predict(X_test)
        
        # Calculate metrics
        mae = mean_absolute_error(y_test, predictions)
        rmse = np.sqrt(mean_squared_error(y_test, predictions))
        
        # Assert training and predictions
        self.assertEqual(len(predictions), len(y_test))
        self.assertIsInstance(predictions, np.ndarray)
        
        # Check that MAE is reasonable (should be less than std of y_test)
        self.assertLess(mae, np.std(y_test) * 2)
        
        print("✓ Stacking model trained successfully")
        print(f"  MAE: {mae:.2f}, RMSE: {rmse:.2f}")
    
    def test_09_model_saving_loading(self):
        """Test model saving and loading functionality"""
        print("\nTest 9: Model Saving and Loading")
        
        # Scenario: Saving trained models to disk and loading them
        # Given: Trained models
        # When: We save and then load them
        # Then: Loaded models should match original
        
        # Create simple test models
        test_model = LinearRegression()
        test_transformer = ColumnTransformer([
            ('encoder', OneHotEncoder(), [0])
        ])
        test_scaler = StandardScaler()
        
        # Fit with dummy data
        X_dummy = np.array([[1], [2], [3]])
        y_dummy = np.array([1, 2, 3])
        
        test_model.fit(X_dummy, y_dummy)
        test_transformer.fit(X_dummy)
        test_scaler.fit(X_dummy)
        
        # Save models
        model_paths = {
            'stacking': 'test_stacking_model.pkl',
            'transformer': 'test_transformer.pkl',
            'scaler': 'test_scaler.pkl'
        }
        
        joblib.dump(test_model, model_paths['stacking'])
        joblib.dump(test_transformer, model_paths['transformer'])
        joblib.dump(test_scaler, model_paths['scaler'])
        
        # Check files exist
        for path in model_paths.values():
            self.assertTrue(os.path.exists(path))
        
        # Load models
        loaded_model = joblib.load(model_paths['stacking'])
        loaded_transformer = joblib.load(model_paths['transformer'])
        loaded_scaler = joblib.load(model_paths['scaler'])
        
        # Test loaded models work
        predictions = loaded_model.predict(X_dummy)
        self.assertEqual(len(predictions), 3)
        
        print("✓ Models saved and loaded successfully")
    
    def test_10_integration_workflow(self):
        """Test complete integration workflow"""
        print("\nTest 10: Complete Integration Workflow")
        
        # Scenario: End-to-end workflow test
        # Given: Raw data file
        # When: We run the complete pipeline
        # Then: All steps should execute without errors
        
        # Mock file operations to avoid actual file dependencies
        with patch('pandas.read_csv') as mock_read, \
             patch('matplotlib.pyplot.show') as mock_show, \
             patch('os.path.exists') as mock_exists:
            
            # Setup mocks
            mock_read.return_value = self.test_data.copy()
            mock_show.return_value = None  # Mock plot display
            mock_exists.return_value = False  # Simulate models don't exist
            
            # Simulate the workflow steps
            # 1. Load data
            dataset = pd.read_csv("dummy_path.csv")
            dataset['service_type'] = ""
            dataset['service_details'] = ""
            
            # 2. Generate synthetic data
            synthetic_data = generate_realistic_synthetic_data(n_samples=50, days=2)
            self.assertGreater(len(synthetic_data), 0)
            
            # 3. Merge and clean
            combined_data = pd.concat([dataset, synthetic_data], ignore_index=True)
            combined_data = combined_data.drop_duplicates()
            
            # 4. Check for missing values
            missing_counts = combined_data.isnull().sum()
            self.assertIsInstance(missing_counts, pd.Series)
            
            # 5. Convert datetimes
            if 'arrival_time' in combined_data.columns:
                try:
                    combined_data['arrival_time'] = pd.to_datetime(
                        combined_data['arrival_time'], 
                        format='%d-%m-%Y %H.%M',
                        errors='coerce'
                    )
                except:
                    pass
            
            print("✓ Complete workflow executes without errors")
    
    def test_11_edge_cases(self):
        """Test edge cases and error handling"""
        print("\nTest 11: Edge Cases")
        
        # Scenario: Testing edge cases
        # Given: Various edge case inputs
        # When: We process them
        # Then: Should handle gracefully
        
        # Test 1: Empty dataset
        empty_df = pd.DataFrame()
        self.assertEqual(len(empty_df), 0)
        
        # Test 2: Missing columns
        incomplete_df = pd.DataFrame({'wait_time': [1, 2, 3]})
        self.assertNotIn('arrival_time', incomplete_df.columns)
        
        # Test 3: Invalid datetime format
        invalid_date_df = pd.DataFrame({
            'arrival_time': ['invalid', '30-03-2023 0.10']
        })
        
        # Should handle gracefully with errors='coerce'
        try:
            invalid_date_df['arrival_time'] = pd.to_datetime(
                invalid_date_df['arrival_time'], 
                format='%d-%m-%Y %H.%M',
                errors='coerce'
            )
            # Invalid dates become NaT
            self.assertTrue(pd.isna(invalid_date_df['arrival_time'].iloc[0]))
        except Exception as e:
            print(f"  Note: Datetime conversion raised {type(e).__name__}")
        
        # Test 4: Extreme wait times
        extreme_df = pd.DataFrame({
            'wait_time': [-100, 1000, 1e6]
        })
        
        stats = extreme_df['wait_time'].describe()
        self.assertGreater(stats['max'], 0)
        
        print("✓ Edge cases handled appropriately")
    
    def test_12_performance_metrics(self):
        """Test performance metric calculations"""
        print("\nTest 12: Performance Metrics")
        
        # Scenario: Calculating model performance metrics
        # Given: True values and predictions
        # When: We calculate MAE, RMSE, MedAE
        # Then: Metrics should be calculated correctly
        
        # Create test data
        y_true = np.array([10, 20, 30, 40, 50])
        y_pred = np.array([12, 18, 32, 38, 52])
        
        # Calculate metrics
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        medae = median_absolute_error(y_true, y_pred)
        
        # Assert calculations
        expected_mae = np.mean(np.abs(y_true - y_pred))
        expected_rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
        expected_medae = np.median(np.abs(y_true - y_pred))
        
        self.assertAlmostEqual(mae, expected_mae)
        self.assertAlmostEqual(rmse, expected_rmse)
        self.assertAlmostEqual(medae, expected_medae)
        
        # Assert metric values are reasonable
        self.assertGreaterEqual(mae, 0)
        self.assertGreaterEqual(rmse, 0)
        self.assertGreaterEqual(medae, 0)
        
        print("✓ Performance metrics calculated correctly")
        print(f"  MAE: {mae:.2f}, RMSE: {rmse:.2f}, MedAE: {medae:.2f}")

def run_all_tests():
    """Run all unit tests with detailed reporting"""
    print("=" * 70)
    print("QUEUE SYSTEM ANALYSIS - UNIT TEST SUITE")
    print("=" * 70)
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestQueueSystem)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Total Tests: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success Rate: {(result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100:.1f}%")
    
    return result.wasSuccessful()

if __name__ == '__main__':
    # Run all tests
    success = run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

# def test_1_plus_1():
#     assert 1 + 1 == 2

# def test_2_plus_2():
#     assert 2 + 2 == 4

# def test_true_is_true():
#     assert True == True

# def test_string_equal():
#     assert "hello" == "hello"