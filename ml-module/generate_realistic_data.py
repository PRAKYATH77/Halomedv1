"""
Generate realistic pharmaceutical sales data with disease correlations
for ML model training. Creates data matching HALOmed database schema.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)

# Disease-Medicine Correlations
DISEASE_MEDICINE_MAP = {
    'Flu': {
        'medicines': ['Oseltamivir 75mg', 'Paracetamol 500mg', 'Cough Syrup', 'Ibuprofen 200mg'],
        'weight': 0.8
    },
    'COVID-19': {
        'medicines': ['Oseltamivir 75mg', 'Paracetamol 500mg', 'Vitamin C', 'Cough Syrup'],
        'weight': 0.75
    },
    'Malaria': {
        'medicines': ['Artemether IV', 'Paracetamol 500mg', 'Quinine 500mg', 'Ibuprofen 200mg'],
        'weight': 0.85
    },
    'Dengue': {
        'medicines': ['Paracetamol 500mg', 'Platelet Support', 'Ibuprofen 200mg', 'Vitamin C'],
        'weight': 0.7
    },
    'Typhoid': {
        'medicines': ['Amoxicillin 250mg', 'Chloramphenicol', 'Paracetamol 500mg', 'Ciprofloxacin 500mg'],
        'weight': 0.8
    },
    'Pneumonia': {
        'medicines': ['Amoxicillin 250mg', 'Cough Syrup', 'Paracetamol 500mg', 'Ciprofloxacin 500mg'],
        'weight': 0.75
    },
    'Common Cold': {
        'medicines': ['Paracetamol 500mg', 'Cough Syrup', 'Vitamin C', 'Ibuprofen 200mg'],
        'weight': 0.65
    }
}

# All available medicines
ALL_MEDICINES = [
    'Paracetamol 500mg', 'Ibuprofen 200mg', 'Aspirin 325mg', 'Cough Syrup',
    'Amoxicillin 250mg', 'Ciprofloxacin 500mg', 'Chloramphenicol',
    'Oseltamivir 75mg', 'Vitamin C', 'Vitamin B Complex',
    'Artemether IV', 'Quinine 500mg', 'Platelet Support'
]

# Generate 1000 days of sales data (2.7 years)
def generate_sales_data(days=1000):
    """Generate realistic sales data with disease correlations"""
    
    start_date = datetime(2023, 1, 1)
    data = []
    
    # Track disease intensity per day (affects medicine sales)
    disease_intensity = {}
    for disease in DISEASE_MEDICINE_MAP.keys():
        disease_intensity[disease] = np.random.rand()
    
    for day in range(days):
        current_date = start_date + timedelta(days=day)
        
        # Update disease intensity (random walk)
        for disease in disease_intensity:
            disease_intensity[disease] += np.random.randn() * 0.1
            disease_intensity[disease] = max(0, min(1, disease_intensity[disease]))
        
        # Generate sales based on disease prevalence
        daily_sales = {}
        
        # Each disease influences medicine sales
        for disease, intensity in disease_intensity.items():
            if intensity > 0.3:  # Disease is active
                for medicine in DISEASE_MEDICINE_MAP[disease]['medicines']:
                    # Sales quantity influenced by disease intensity
                    qty = int(np.random.poisson(intensity * 15))
                    if medicine not in daily_sales:
                        daily_sales[medicine] = {'qty': 0, 'revenue': 0}
                    daily_sales[medicine]['qty'] += qty
        
        # Add background sales (non-disease related)
        for medicine in ALL_MEDICINES:
            if medicine not in daily_sales:
                daily_sales[medicine] = {'qty': 0, 'revenue': 0}
            
            # Random background sales
            bg_qty = np.random.poisson(3)
            daily_sales[medicine]['qty'] += bg_qty
        
        # Create records with prices
        medicine_prices = {
            'Paracetamol 500mg': 1.5, 'Ibuprofen 200mg': 1.0, 'Aspirin 325mg': 0.8,
            'Cough Syrup': 3.0, 'Amoxicillin 250mg': 4.0, 'Ciprofloxacin 500mg': 5.5,
            'Chloramphenicol': 6.0, 'Oseltamivir 75mg': 12.0, 'Vitamin C': 0.8,
            'Vitamin B Complex': 2.5, 'Artemether IV': 15.0, 'Quinine 500mg': 8.0,
            'Platelet Support': 25.0
        }
        
        for medicine, sales_info in daily_sales.items():
            if sales_info['qty'] > 0:
                price = medicine_prices.get(medicine, 5.0)
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'product_name': medicine,
                    'qty': sales_info['qty'],
                    'price': price,
                    'total_revenue': sales_info['qty'] * price
                })
    
    return pd.DataFrame(data)

# Generate 1000 days of disease case data
def generate_cases_data(days=1000):
    """Generate realistic disease case data with correlations"""
    
    start_date = datetime(2023, 1, 1)
    regions = ['North', 'South', 'East', 'West', 'Central']
    data = []
    
    # Track disease levels per region
    disease_levels = {}
    for region in regions:
        disease_levels[region] = {disease: np.random.rand() for disease in DISEASE_MEDICINE_MAP.keys()}
    
    for day in range(days):
        current_date = start_date + timedelta(days=day)
        
        # Update disease levels (random walk with seasonality)
        season_effect = np.sin(day * 2 * np.pi / 365) * 0.3  # Seasonal variation
        
        for region in regions:
            for disease in disease_levels[region]:
                disease_levels[region][disease] += np.random.randn() * 0.08 + season_effect * 0.05
                disease_levels[region][disease] = max(0, min(1, disease_levels[region][disease]))
        
        # Generate cases per region
        for region in regions:
            total_cases = 0
            for disease, level in disease_levels[region].items():
                cases = int(np.random.poisson(level * 20))
                total_cases += cases
            
            if total_cases > 0:
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'region': region,
                    'total_cases': total_cases,
                    'flu': int(np.random.poisson(disease_levels[region]['Flu'] * 10)),
                    'covid': int(np.random.poisson(disease_levels[region]['COVID-19'] * 8)),
                    'malaria': int(np.random.poisson(disease_levels[region]['Malaria'] * 12)),
                    'dengue': int(np.random.poisson(disease_levels[region]['Dengue'] * 9)),
                    'typhoid': int(np.random.poisson(disease_levels[region]['Typhoid'] * 5)),
                    'pneumonia': int(np.random.poisson(disease_levels[region]['Pneumonia'] * 7)),
                    'cold': int(np.random.poisson(disease_levels[region]['Common Cold'] * 15))
                })
    
    return pd.DataFrame(data)

# Generate data
print("Generating realistic pharmaceutical sales data...")
sales_df = generate_sales_data(days=1000)

print("Generating disease case data...")
cases_df = generate_cases_data(days=1000)

# Save to CSV
sales_file = os.path.join(data_dir, 'sales.csv')
cases_file = os.path.join(data_dir, 'cases.csv')

sales_df.to_csv(sales_file, index=False)
cases_df.to_csv(cases_file, index=False)

print(f"\n✅ Data generated successfully!")
print(f"📊 Sales data: {len(sales_df)} records → {sales_file}")
print(f"📊 Cases data: {len(cases_df)} records → {cases_file}")
print(f"\nSales data columns: {list(sales_df.columns)}")
print(f"Cases data columns: {list(cases_df.columns)}")
print(f"\nSales data sample:\n{sales_df.head()}")
print(f"\nCases data sample:\n{cases_df.head()}")
print(f"\nDisease correlations built-in:")
for disease, info in DISEASE_MEDICINE_MAP.items():
    print(f"  {disease}: {', '.join(info['medicines'][:3])}...")
