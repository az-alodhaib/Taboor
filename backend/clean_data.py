import pandas as pd
import numpy as np

def remove_duplicates(data):
    data = data.drop_duplicates()
    return data

def check_missing_values(data):
    missing = data.isnull().sum()
    return missing

def convert_datetime_columns(data):
    data['arrival_time'] = pd.to_datetime(data['arrival_time'], format='%d-%m-%Y %H.%M')
    data['start_time'] = pd.to_datetime(data['start_time'], format='%d-%m-%Y %H.%M')
    data['finish_time'] = pd.to_datetime(data['finish_time'])
    return data

def find_extreme_wait_times(data, threshold=240):
    stats = data['wait_time'].describe()
    extreme_waits = data[data['wait_time'] > threshold]
    return stats, len(extreme_waits)