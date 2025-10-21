import pandas as pd
import pytest
from backend.clean_data import remove_duplicates, check_missing_values, convert_datetime_columns, find_extreme_wait_times

class TestCleanData:
    
    def test_remove_duplicates(self):
        duplicate_data = pd.DataFrame({
            'arrival_time': ['15-12-2024 14.30', '15-12-2024 14.30', '16-12-2024 09.15'],
            'start_time': ['15-12-2024 14.45', '15-12-2024 14.45', '16-12-2024 09.30'],
            'finish_time': ['15-12-2024 15.00', '15-12-2024 15.00', '16-12-2024 09.50'],
            'wait_time': [15, 15, 15],
            'customer_id': [1, 1, 2]
        })
        
        result = remove_duplicates(duplicate_data)
        
        assert len(result) == 2
        assert result['customer_id'].nunique() == 2

    def test_check_missing_values(self):
        test_data = pd.DataFrame({
            'arrival_time': ['15-12-2024 14.30', None, '16-12-2024 09.15'],
            'start_time': ['15-12-2024 14.45', '15-12-2024 14.45', None],
            'finish_time': ['15-12-2024 15.00', '15-12-2024 15.00', '16-12-2024 09.50'],
            'wait_time': [15, None, 20],
            'queue_length': [5, 8, 12]
        })
        
        result = check_missing_values(test_data)
        
        assert result['arrival_time'] == 1
        assert result['start_time'] == 1
        assert result['wait_time'] == 1
        assert result['finish_time'] == 0
        assert result['queue_length'] == 0

    def test_convert_datetime_columns(self):
        test_data = pd.DataFrame({
            'arrival_time': ['30-03-2023 0.10', '30-03-2023 1.58'],
            'start_time': ['30-03-2023 0.16', '30-03-2023 2.04'],
            'finish_time': ['2023-03-30 00:25:53.200000000', '2023-03-30 02:16:49.000000000'],
            'wait_time': [9.82, 12.20],
            'queue_length': [28, 27]
        })
        
        result = convert_datetime_columns(test_data)
        
        assert result['arrival_time'].dtype == result['start_time'].dtype
        assert result['start_time'].dtype == result['finish_time'].dtype
        assert result['arrival_time'].dtype == result['finish_time'].dtype

    def test_find_extreme_wait_times(self):
        test_data = pd.DataFrame({
            'arrival_time': ['30-03-2023 0.10', '30-03-2023 1.58', '30-03-2023 6.51', '30-03-2023 8.00'],
            'start_time': ['30-03-2023 0.16', '30-03-2023 2.04', '30-03-2023 6.58', '30-03-2023 12.15'],
            'finish_time': ['2023-03-30 00:25:53.200000000', '2023-03-30 02:16:49.000000000', '2023-03-30 07:25:38.800000000', '2023-03-30 12:45:00.000000000'],
            'wait_time': [9.82, 12.20, 6.85, 255.0],  # 255 minutes = 4 hours 15 minutes
            'queue_length': [28, 27, 24, 50]
        })
        
        stats, extreme_count = find_extreme_wait_times(test_data, threshold=240)  # 240 minutes = 4 hours
        
        assert extreme_count == 1
        assert stats['max'] == 255.0
        assert stats['min'] == 6.85
        assert stats['mean'] > 0