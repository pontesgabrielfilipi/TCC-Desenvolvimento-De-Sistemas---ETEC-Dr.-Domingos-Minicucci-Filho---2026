FROM python:3.12-slim

WORKDIR /app

# Atualiza pip e instala dependências do sistema (necessário para algumas libs de ML)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Em desenvolvimento (com reload)
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]