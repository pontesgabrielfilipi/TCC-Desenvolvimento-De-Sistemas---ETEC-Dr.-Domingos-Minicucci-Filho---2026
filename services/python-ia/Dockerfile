FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Os artefatos não são versionados; gere o modelo real com os CSVs versionados.
RUN python train_model.py

EXPOSE 8000

CMD ["python", "-m", "api.main"]
