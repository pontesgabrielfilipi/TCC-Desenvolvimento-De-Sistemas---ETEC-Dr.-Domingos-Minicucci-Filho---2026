import joblib
import math
import os    
import unicodedata
import ipaddress
from pathlib import Path

from fastapi import FastAPI, HTTPException, status
import uvicorn
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse

app = FastAPI(title="Delivery Time Prediction API", version='6.0')

load_dotenv()


def bounded_integer(name: str, default: str, minimum: int, maximum: int) -> int:
    value = os.getenv(name, default)
    try:
        result = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} deve ser inteiro entre {minimum} e {maximum}") from exc
    if not minimum <= result <= maximum:
        raise ValueError(f"{name} deve estar entre {minimum} e {maximum}")
    return result


def strict_boolean(name: str, default: str) -> bool:
    value = os.getenv(name, default).strip().lower()
    if value not in {"true", "false"}:
        raise ValueError(f"{name} deve ser true ou false")
    return value == "true"


HOST = os.getenv("APP_HOST", "0.0.0.0")
try:
    ipaddress.ip_address(HOST)
except ValueError as exc:
    raise ValueError("APP_HOST deve ser um endereco IP valido") from exc

PORT = bounded_integer("APP_PORT", "8000", 1, 65535)
WORKERS = bounded_integer("APP_WORKERS", "1", 1, 8)
RELOAD = strict_boolean("APP_RELOAD", "false")
if RELOAD and WORKERS > 1:
    raise ValueError("APP_RELOAD=true requer APP_WORKERS=1")
MODEL_DIR = Path(os.getenv("MODEL_DIR", str(Path(__file__).resolve().parents[1] / "model")))
if not MODEL_DIR.is_absolute():
    raise ValueError("MODEL_DIR deve ser um caminho absoluto")

model = None
encoders = None
geo_dict = None
model_error = None


def load_artifacts():
    global model, encoders, geo_dict, model_error
    try:
        model = joblib.load(MODEL_DIR / "model.pkl")
        encoders = joblib.load(MODEL_DIR / "encoders.pkl")
        geo_dict = joblib.load(MODEL_DIR / "geo_dict.pkl")
        model_error = None
    except Exception as exc:  # Mantém a API diagnosticável quando faltar artefato.
        model_error = str(exc)


load_artifacts()


@app.get("/health", tags=["health"])
async def health_check():
    if model_error:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "delivery-time-ia",
                "detail": "model artifacts unavailable",
            },
        )
    return {"status": "healthy", "service": "delivery-time-ia"}

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

mae = 3  # erro médio salvo no treino

# ===== SCHEMA =====
class Pedido(BaseModel):
    price: float = Field(gt=0)
    customer_zip_code_prefix: int = Field(ge=0)
    seller_zip_code_prefix: int = Field(ge=0)
    customer_city: str = Field(min_length=1)
    seller_city: str = Field(min_length=1)
    product_category_name: str = Field(min_length=1)
    product_weight_g: float = Field(gt=0)
    product_length_cm: float = Field(gt=0)
    product_height_cm: float = Field(gt=0)
    product_width_cm: float = Field(gt=0)
    order_weekday: int = Field(ge=0, le=6)
    order_month: int = Field(ge=1, le=12)
    order_hour: int = Field(ge=0, le=23)




# ===== FUNÇÕES DE PROCESSAMENTO =====

def preparar_dados(pedido_dict):
    return pd.DataFrame([pedido_dict])


def normalizar_texto(valor):
    texto = unicodedata.normalize("NFKD", str(valor))
    return texto.encode("ascii", "ignore").decode("ascii").lower().strip()


def normalizar_strings(data):
    colunas = ["customer_city", "seller_city", "product_category_name"]

    for col in colunas:
        data[col] = data[col].map(normalizar_texto)

    # Nomes agregados usados pelo backend precisam apontar para classes reais
    # do dataset Olist, sem atribuir um código arbitrário a classes desconhecidas.
    aliases_categoria = {
        "livros": "livros_interesse_geral",
        "utilidades_gerais": "utilidades_domesticas",
    }
    data["product_category_name"] = data["product_category_name"].replace(aliases_categoria)

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
    if model_error:
        raise HTTPException(status_code=503, detail="Modelo de previsão indisponível")

    data = preparar_dados(pedido.model_dump())

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
        "api.main:app",
        host=HOST,
        port=PORT,
        workers=WORKERS,
        reload=RELOAD,
    )
