"""Treina e persiste os artefatos usados pela API a partir dos dados Olist."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
MODEL = ROOT / "model"
FEATURES = [
    "price", "customer_zip_code_prefix", "customer_city",
    "seller_zip_code_prefix", "seller_city", "product_category_name",
    "product_weight_g", "product_length_cm", "product_height_cm",
    "product_width_cm", "order_weekday", "order_month", "order_hour",
    "distance",
]


def distance(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    value = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(value))


def train() -> None:
    customers = pd.read_csv(DATA / "olist_customers_dataset.csv")
    items = pd.read_csv(DATA / "olist_order_items_dataset.csv")
    orders = pd.read_csv(DATA / "olist_orders_dataset.csv")
    products = pd.read_csv(DATA / "olist_products_dataset.csv")
    sellers = pd.read_csv(DATA / "olist_sellers_dataset.csv")
    geolocation = pd.read_csv(DATA / "olist_geolocation_dataset.csv")
    geolocation = geolocation.drop(columns=["geolocation_city", "geolocation_state"])
    geolocation = geolocation.groupby("geolocation_zip_code_prefix").mean().reset_index()

    frame = orders.merge(items, on="order_id").merge(customers, on="customer_id")
    frame = frame.merge(sellers, on="seller_id").merge(products, on="product_id")
    frame = frame.merge(geolocation, left_on="customer_zip_code_prefix", right_on="geolocation_zip_code_prefix", how="left")
    frame = frame.rename(columns={"geolocation_lat": "customer_lat", "geolocation_lng": "customer_lng"})
    frame = frame.merge(geolocation, left_on="seller_zip_code_prefix", right_on="geolocation_zip_code_prefix", how="left", suffixes=("_customer", "_seller"))
    frame = frame.rename(columns={"geolocation_lat": "seller_lat", "geolocation_lng": "seller_lng"})
    frame["distance"] = distance(frame.customer_lat, frame.customer_lng, frame.seller_lat, frame.seller_lng)
    purchased = pd.to_datetime(frame.order_purchase_timestamp)
    delivered = pd.to_datetime(frame.order_delivered_customer_date)
    frame["prazo_entrega_dias"] = (delivered - purchased).dt.days
    frame["order_weekday"], frame["order_month"], frame["order_hour"] = purchased.dt.weekday, purchased.dt.month, purchased.dt.hour
    frame = frame[(frame.prazo_entrega_dias >= 0) & (frame.prazo_entrega_dias <= 30)]
    frame = frame[FEATURES + ["prazo_entrega_dias"]].dropna()

    encoders = {}
    for column in ("customer_city", "seller_city", "product_category_name"):
        encoder = LabelEncoder()
        frame[column] = encoder.fit_transform(frame[column].astype(str).str.lower().str.strip())
        encoders[column] = encoder

    # Limites evitam que cada worker precise de ~2 GB sem abandonar o modelo real.
    estimator = RandomForestRegressor(
        n_estimators=50,
        max_depth=20,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    estimator.fit(frame[FEATURES], frame["prazo_entrega_dias"])
    geo_dict = geolocation.set_index("geolocation_zip_code_prefix")[["geolocation_lat", "geolocation_lng"]].to_dict("index")
    MODEL.mkdir(exist_ok=True)
    joblib.dump(estimator, MODEL / "model.pkl", compress=3)
    joblib.dump(encoders, MODEL / "encoders.pkl", compress=3)
    joblib.dump(geo_dict, MODEL / "geo_dict.pkl", compress=3)


if __name__ == "__main__":
    train()
