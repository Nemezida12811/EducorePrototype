# Build context = repository root (see docker-compose.yml). Builds the React app, then serves it with Caddy.
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Empty VITE_API_URL = same-origin ("/api/v1"). VITE_BASE=/ because the app now lives at the site root.
ENV VITE_API_URL="" VITE_BASE=/
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
