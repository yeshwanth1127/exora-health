FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates espeak-ng libgomp1 libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY demo ./demo

RUN groupadd --system --gid 10001 appuser \
    && useradd --system --home /app --uid 10001 --gid appuser appuser \
    && mkdir -p /data /models \
    && chown -R appuser:appuser /app /data /models

USER appuser
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=6 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/live')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
