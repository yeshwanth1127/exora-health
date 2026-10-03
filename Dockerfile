FROM node:22-alpine AS frontend-builder
WORKDIR /src
COPY hospital-webpage/package*.json ./
RUN npm ci
COPY hospital-webpage/ ./
ARG VITE_API_URL=http://localhost:8000
ARG VITE_HOSPITAL_SLUG=exora-demo
ENV VITE_API_URL=$VITE_API_URL VITE_HOSPITAL_SLUG=$VITE_HOSPITAL_SLUG
RUN npm run build

FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY hospital-backend/pyproject.toml hospital-backend/README.md /app/backend/
COPY hospital-backend/app /app/backend/app
COPY hospital-backend/migrations /app/backend/migrations
COPY hospital-backend/alembic.ini /app/backend/alembic.ini
RUN pip install --no-cache-dir /app/backend
COPY frontend-nginx.conf /etc/nginx/nginx.conf
COPY start-demo.sh /app/start-demo.sh
COPY --from=frontend-builder /src/dist /usr/share/nginx/html
RUN chmod +x /app/start-demo.sh && mkdir -p /data
ENV APP_ENV=development DATABASE_URL=sqlite:////data/avocado.db \
    ALLOWED_ORIGINS=http://localhost:8080,http://127.0.0.1:8080 \
    DEFAULT_HOSPITAL_SLUG=exora-demo JITSI_DOMAIN=meet.jit.si JITSI_APP_ID=exora-demo \
    JITSI_SECRET=demo-jitsi-secret-change-me
ENV TELECONSULTATION_JOIN_EARLY_MINUTES=10080
EXPOSE 8080 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/live')" || exit 1
CMD ["/app/start-demo.sh"]
