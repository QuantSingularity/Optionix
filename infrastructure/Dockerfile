# Optionix Multi-Stage Production Dockerfile
# Financial-grade security and compliance

# ── Build stage ────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Production stage ───────────────────────────────────────────────────────────
FROM python:3.11-slim

RUN groupadd -r optionix && useradd -r -g optionix -u 1000 -m optionix

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder stage into the correct user home
COPY --from=builder /root/.local /home/optionix/.local

# Copy application code
COPY --chown=optionix:optionix . /app

# Create necessary writable dirs while still root
RUN mkdir -p /app/logs /tmp/app \
    && chown -R optionix:optionix /app/logs /tmp/app

ENV PATH=/home/optionix/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

USER optionix

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
