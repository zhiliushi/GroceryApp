# Stage 1: Build the web-admin SPA
FROM node:20-slim AS spa-builder

WORKDIR /build
# Copy package files for npm ci (layer caching)
COPY web-admin/package.json web-admin/package-lock.json ./web-admin/
RUN cd web-admin && npm ci --ignore-scripts

# Copy source and build
# Firebase client config — public keys, safe to embed in SPA bundle
COPY web-admin/ ./web-admin/
RUN cd web-admin && \
    echo "VITE_FIREBASE_API_KEY=AIzaSyDv9nE_kgel4c43zVhI8n9HzFpWPxQc_FA" > .env && \
    echo "VITE_FIREBASE_AUTH_DOMAIN=groceryapp-b91a7.firebaseapp.com" >> .env && \
    echo "VITE_FIREBASE_PROJECT_ID=groceryapp-b91a7" >> .env && \
    npx vite build
# vite.config.ts: outDir: '../static/spa' → output is at /build/static/spa/

# Stage 2: Python backend
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System packages — Tesseract OCR for receipt scanning (English + Malay)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-msa \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy SPA build output from stage 1 (overwrites any stale/empty static/spa/)
COPY --from=spa-builder /build/static/spa/ ./static/spa/

# Non-root user for security
RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8000

CMD gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --access-logfile -
