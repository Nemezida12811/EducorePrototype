FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 ENV=production DATABASE_URL=sqlite:////data/educore.db STORAGE_DIR=/data/files
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY app ./app
RUN useradd -m app && mkdir -p /data && chown app /data
USER app
VOLUME /data
EXPOSE 8000
# --forwarded-allow-ips "*" is safe ONLY because the API port is never published (only the proxy reaches it);
# it makes request.client.host the real visitor IP, which rate limits and the audit log rely on.
# SQLite is a single file: keep /data on a persistent volume and run ONE container (several workers in it are fine).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
