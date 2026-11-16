FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 ENV=production DATABASE_URL=sqlite:////data/educore.db STORAGE_DIR=/data/files
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY app ./app

# Quality gate: the image is only built when the whole test suite passes (a failing test fails the deploy, and Coolify
# keeps the previous version running because it removes the old containers only after a successful build).
FROM base AS test
COPY requirements-dev.txt ./
RUN pip install -r requirements-dev.txt
COPY tests ./tests
RUN python -m pytest -q && touch /tests-passed

FROM base AS final
COPY --from=test /tests-passed /tmp/tests-passed
RUN useradd -m app && mkdir -p /data && chown app /data
USER app
VOLUME /data
EXPOSE 8000
# --forwarded-allow-ips "*" is safe ONLY because the API port is never published (only the proxy reaches it);
# it makes request.client.host the real visitor IP, which rate limits and the audit log rely on.
# SQLite is a single file: keep /data on a persistent volume and run ONE container (several workers in it are fine).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
