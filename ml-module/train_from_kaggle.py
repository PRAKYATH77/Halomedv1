"""
Train script for the ML module using downloaded Kaggle CSVs.

Place prepared dataset files under `ml-module/data/`:
- `sales.csv`  : timestamped retail/sales transactions (e.g., ecommerce POS, product name, qty, price)
- `cases.csv`  : daily regional case counts (columns: `date`, `region` (optional), `cases`)

This script will:
- Aggregate sales into simple pharmacy-related feature groups by date
- Align with case counts on date (and region if present)
- Create a 3-way risk label (low/medium/high) using tertiles of case counts
- Train a RandomForest classifier to predict the risk level
- Persist the trained model and preprocessing objects to `ml-module/models/outbreak_model.joblib`

Run:
    python train_from_kaggle.py

"""
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib


DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODELS_DIR, exist_ok=True)


def load_sales(path):
    df = pd.read_csv(path, low_memory=False)
    # Try to find a date column
    date_cols = [c for c in df.columns if 'date' in c.lower() or 'timestamp' in c.lower()]
    if date_cols:
        df['date'] = pd.to_datetime(df[date_cols[0]], errors='coerce').dt.date
    else:
        # attempt to parse a first column
        try:
            df['date'] = pd.to_datetime(df.iloc[:, 0], errors='coerce').dt.date
        except Exception:
            raise ValueError('Could not detect a date column in sales CSV')

    # normalize product/name column
    name_cols = [c for c in df.columns if 'product' in c.lower() or 'item' in c.lower() or 'name' in c.lower()]
    if name_cols:
        df['product_name'] = df[name_cols[0]].astype(str)
    else:
        df['product_name'] = df.iloc[:, 1].astype(str)

    # quantity and price
    qty_cols = [c for c in df.columns if 'qty' in c.lower() or 'quantity' in c.lower()]
    if qty_cols:
        df['qty'] = pd.to_numeric(df[qty_cols[0]], errors='coerce').fillna(1)
    else:
        df['qty'] = 1

    price_cols = [c for c in df.columns if 'price' in c.lower() or 'amount' in c.lower()]
    if price_cols:
        df['price'] = pd.to_numeric(df[price_cols[0]], errors='coerce').fillna(0.0)
    else:
        df['price'] = 0.0

    return df[['date', 'product_name', 'qty', 'price']]


def load_cases(path):
    df = pd.read_csv(path, low_memory=False)
    # Expect columns: date, cases, optional region
    cols = {c.lower(): c for c in df.columns}
    if 'date' in cols:
        df['date'] = pd.to_datetime(df[cols['date']], errors='coerce').dt.date
    else:
        df['date'] = pd.to_datetime(df.iloc[:, 0], errors='coerce').dt.date

    # cases value
    key_cases = None
    for k in ['cases', 'new_cases', 'confirmed']:
        if k in cols:
            key_cases = cols[k]
            break
    if key_cases is None:
        # try numeric column other than date
        key_cases = df.columns[1]

    df['cases'] = pd.to_numeric(df[key_cases], errors='coerce').fillna(0).astype(int)

    # optional region
    region_col = None
    for k in ['region', 'state', 'country', 'location']:
        if k in cols:
            region_col = cols[k]
            break
    if region_col:
        df['region'] = df[region_col].astype(str)
    else:
        df['region'] = 'all'

    return df[['date', 'region', 'cases']]


def engineer_features(sales_df):
    # create simple keyword buckets for pharmacy-like products
    def bucket(row_name):
        name = row_name.lower()
        return pd.Series({
            'respiratory': int(any(k in name for k in ['cough', 'cold', 'respir', 'inhaler', 'bronch'])),
            'fever': int(any(k in name for k in ['fever', 'paracetamol', 'acetaminophen', 'ibuprofen'])),
            'antibiotic': int(any(k in name for k in ['amoxicillin', 'ciprofloxacin', 'antibiot'])),
            'antiviral': int(any(k in name for k in ['antiviral', 'oseltamivir', 'tamiflu'])),
            'other': 1
        })

    features = []
    for date, g in sales_df.groupby('date'):
        total_qty = g['qty'].sum()
        total_value = (g['qty'] * g['price']).sum()
        tbl = g['product_name'].apply(lambda x: bucket(x))
        sums = tbl.sum()
        row = {
            'date': date,
            'total_qty': total_qty,
            'total_value': total_value,
            'respiratory_sales': sums.get('respiratory', 0),
            'fever_sales': sums.get('fever', 0),
            'antibiotic_sales': sums.get('antibiotic', 0),
            'antiviral_sales': sums.get('antiviral', 0),
        }
        features.append(row)

    feat_df = pd.DataFrame(features)
    return feat_df


def prepare_training(sales_path, cases_path):
    sales = load_sales(sales_path)
    cases = load_cases(cases_path)

    feat = engineer_features(sales)
    # merge
    merged = feat.merge(cases.groupby('date').agg({'cases': 'sum'}).reset_index(), on='date', how='left')
    merged['cases'] = merged['cases'].fillna(0).astype(int)

    # create 3-level risk label
    merged['risk'] = pd.qcut(merged['cases'].rank(method='first'), q=3, labels=['low', 'medium', 'high'])
    merged = merged.dropna(subset=['risk'])

    X = merged[['total_qty', 'total_value', 'respiratory_sales', 'fever_sales', 'antibiotic_sales', 'antiviral_sales']]
    y = merged['risk']
    return X, y


def train_and_save(X, y, out_path):
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_enc, test_size=0.2, random_state=42, stratify=y_enc)

    clf = RandomForestClassifier(n_estimators=200, random_state=42)
    clf.fit(X_train, y_train)

    preds = clf.predict(X_test)
    print('Classification report:\n', classification_report(y_test, preds, target_names=le.classes_))
    print('Confusion matrix:\n', confusion_matrix(y_test, preds))

    obj = {
        'classifier': clf,
        'scaler': scaler,
        'risk_encoder': le,
        'diseases': ['Flu', 'COVID-19', 'Dengue', 'Malaria', 'Typhoid', 'Common Cold', 'Pneumonia'],
        'risk_levels': list(le.classes_),
    }
    joblib.dump(obj, out_path)
    print('Saved trained model to', out_path)


def main():
    sales_path = os.path.join(DATA_DIR, 'sales.csv')
    cases_path = os.path.join(DATA_DIR, 'cases.csv')
    if not os.path.exists(sales_path) or not os.path.exists(cases_path):
        print('Missing datasets. Put `sales.csv` and `cases.csv` under', DATA_DIR)
        return

    X, y = prepare_training(sales_path, cases_path)
    out_path = os.path.join(MODELS_DIR, 'outbreak_model.joblib')
    train_and_save(X, y, out_path)


if __name__ == '__main__':
    main()
