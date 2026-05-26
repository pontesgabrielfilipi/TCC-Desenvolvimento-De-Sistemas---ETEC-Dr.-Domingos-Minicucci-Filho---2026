from fastapi import FastAPI, HTTPException, status
import joblib
import pandas as pd
import numpy as np
import math
import os    
import uvicorn
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

app = FastAPI(title="Delivery Time Prediction API", version='6.0')

# ==================== ENDPOINT DE HEALTH ==================== 
@app.get("/health", status_code=status.HTTP_200_OK, tags=["health"]) 
async def health_check(): 
    # Endpoint simples para Docker healthcheck
    return JSONResponse( 
        content={ "status": "healthy", 
                 "service": "delivery-time-ia", 
                 "timestamp": __import__('datetime').datetime.now().isoformat() 
                 }
        )

# define a porta
load_dotenv()
PORT = int(os.getenv("HOST_API_PORT", 8000))

# ===== FUNÇÃO DISTÂNCIA =====
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371

    lat1 = np.radians(lat1)
    lon1 = np.radians(lon1)
    lat2 = np.radians(lat2)
    lon2 = np.radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = np.sin(dlat / 2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2)**2
    c = 2 * np.arcsin(np.sqrt(a))

    return R * c

# ===== LOAD =====
model = joblib.load("model/model.pkl")
encoders = joblib.load("model/encoders.pkl")
geo_dict = joblib.load("model/geo_dict.pkl")
mae = 3  # erro médio salvo no treino

# ===== SCHEMA =====
class Pedido(BaseModel):
    price: float = Field(gt=0)
    customer_zip_code_prefix: int
    seller_zip_code_prefix: int
    customer_city: str
    seller_city: str
    product_category_name: str
    product_weight_g: float = Field(gt=0)
    product_length_cm: float = Field(gt=0)
    product_height_cm: float = Field(gt=0)
    product_width_cm: float = Field(gt=0)
    order_weekday: int
    order_month: int
    order_hour: int




# ===== FUNÇÕES DE PROCESSAMENTO =====

def preparar_dados(pedido_dict):
    return pd.DataFrame([pedido_dict])


def normalizar_strings(data):
    colunas = ["customer_city", "seller_city", "product_category_name"]

    for col in colunas:
        data[col] = data[col].str.lower().str.strip()

    return data


def get_lat_lng(cep):
    if cep not in geo_dict:
        return None, None
    return geo_dict[cep]["geolocation_lat"], geo_dict[cep]["geolocation_lng"]


def adicionar_distancia(data):
    c_lat, c_lng = get_lat_lng(data.loc[0, "customer_zip_code_prefix"])
    s_lat, s_lng = get_lat_lng(data.loc[0, "seller_zip_code_prefix"])

    # fallback simples
    if None in [c_lat, c_lng, s_lat, s_lng]:
        data["distance"] = 1000
        return data

    data["distance"] = calculate_distance(c_lat, c_lng, s_lat, s_lng)
    return data


def aplicar_encoders(data):
    for col in encoders:
        valor = data.loc[0, col]

        if valor not in encoders[col].classes_:
            raise HTTPException(
                status_code=400,
                detail=f"{valor} não reconhecido em {col}"
            )

        data.loc[0, col] = encoders[col].transform([valor])[0]

    return data


# ===== ROTAS =====

@app.get("/")
def home():
    return {"message": "API de previsão de prazo de entrega"}


@app.post("/predict")
def predict(pedido: Pedido):

    data = preparar_dados(pedido.dict())

    data = normalizar_strings(data)
    data = adicionar_distancia(data)
    data = aplicar_encoders(data)

    # garante ordem correta
    data = data[model.feature_names_in_]

    prediction = float(model.predict(data)[0])

    # intervalo baseado no erro médio
    min_days = max(0, prediction - mae)
    max_days = prediction + mae

    # deixa mais realista (dias inteiros)
    min_days = math.floor(min_days)
    max_days = math.ceil(max_days)

    return {
        "prazo_entrega": {
            "min_dias": min_days,
            "max_dias": max_days,
            "estimativa_central": round(prediction, 1)
        }
    }

if __name__ == "__main__":


    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=PORT,
        reload=True
    )