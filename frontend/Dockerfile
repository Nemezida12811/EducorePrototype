# Build context = repository root (see docker-compose.yml / compose.yaml). Builds the React app, then serves it with Caddy,
# which also forwards /api/*, /health* and /openapi.json to the API container.
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Empty VITE_API_URL = same-origin ("/api/v1"). VITE_BASE=/ because the app lives at the site root.
ENV VITE_API_URL="" VITE_BASE=/
# Quality gate: unit tests and type check must pass before the app is built (a failure fails the deploy).
RUN npm test
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
