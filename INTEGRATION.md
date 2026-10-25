# EduCore: how frontend and backend fit together

## Repository layout (monorepo)

```
educore/
├── frontend/            <- your EducorePrototype repo (React 19 + Vite + TypeScript + Tailwind)
│   └── src/
│       ├── lib/api.ts          [add]    HTTP client: token refresh, errors, downloads, uploads
│       ├── auth/AuthContext.tsx [add]   session state, role guard
│       └── data/ -> api/       [replace] mock data layer -> calls to the API
├── backend/             <- educore-api (FastAPI + SQLite), unchanged API, Docker-ready
├── deploy/              Caddyfile, docker-compose.yml, web.Dockerfile, .env.example
└── .github/workflows/ci.yml  tests + type-check + build + docker build
```

`frontend-patch/` in this archive holds the two new frontend files and the Vite config snippet; copy them into `frontend/`.

## Runtime picture

Browser → **Caddy** (HTTPS, serves the built SPA, forwards `/api/*` and `/health`) → **FastAPI** container → **SQLite file** + **files folder** on one volume.
The API port is never published; only Caddy is reachable from outside. One origin = no CORS, no mixed content, no tokens in URLs.

## Changes to make

### Frontend
1. Copy `src/lib/api.ts` and `src/auth/AuthContext.tsx`; wrap the app in `<AuthProvider>`.
2. Merge `vite.config.snippet.ts` (`base` from `VITE_BASE`, dev proxy `/api` → `localhost:8000`). Add `.env.development` with `VITE_API_URL=` (empty).
3. Replace the demo **role switcher** with the real login screen: `signIn()`; if it returns a `challengeToken`, show a 6-digit code step and call `verifyCode()`. The role comes from `user.role`.
4. Guard routes with `<RequireRole roles={['admin']} fallback={<Navigate to="/login" />}>`; keep hiding menu items by role, but the backend is the real gatekeeper.
5. Replace each mock-data read/write with `api()` calls (table below). Recommended: TanStack Query for loading/error/caching, and invalidate the affected queries after each mutation.
6. IDs are **UUID strings**, not demo slugs (`ads2`, `oop`). List endpoints return `{ items, page, pageSize, total }`. Errors are `{ error, message, details? }` → caught as `ApiError` (`err.code === 'prerequisites_missing'`, …).
7. Derived values the UI computed locally (course fill, credits earned, study-plan status, GPA) now come from the API: use them instead of recomputing.
8. File buttons (transcript PDF, `.ics`, CSV/XLSX, course PDFs) must use `download()` — a plain `<a href>` cannot send the Authorization header.
9. Remove the GitHub Pages deploy workflow (or keep it only as a demo build with `VITE_API_URL` pointing to the API and `CORS_ORIGINS` set on the backend).

### Backend (already done in this archive)
- `--forwarded-allow-ips "*"` in the Dockerfile so the real visitor IP reaches rate limits and the audit log (safe because the API port is not published).
- Compose has no CORS (`CORS_ORIGINS=""`), `ENV=production` (Swagger off, HSTS on), one volume `/data`.
- Seed on first run creates only the institution and the super admin.

### Feature → endpoints

| Frontend feature | Endpoints |
|---|---|
| Sign-in, 2FA, sessions | `POST /auth/login`, `/auth/2fa/verify`, `/auth/refresh`, `/auth/logout`, `GET /auth/sessions`, `POST /auth/2fa/enable` |
| Profile, notification settings, data export | `GET/PUT /users/me`, `GET /users/me/export`, `PUT /notifications/settings` |
| Course catalog, detail, my courses | `GET /courses` (`?mine=true`, filters), `GET /courses/{id}` |
| Enroll / withdraw / waitlist | `POST /enrollments`, `DELETE /enrollments/{id}`, `GET /enrollments/me`, `GET /courses/{id}/waitlist` |
| Teacher: edit course, sessions, exams, PDFs | `PUT /courses/{id}`, `POST /courses/{id}/sessions`, `PUT/DELETE /sessions/{id}`, `POST /courses/{id}/exams`, `POST /courses/{id}/documents` |
| Teacher: roster and grading | `GET /courses/{id}/students`, `GET /grades/course/{id}`, `POST /grades`, `GET /grades/{id}/history` |
| Student: grades, transcript, certificate | `GET /grades/me`, `GET /grades/me/transcript`, `POST /documents/transcript-request` |
| Schedule, calendar, exams | `GET /schedule/me`, `/schedule/me/export`, `/calendar/events`, `/exams` |
| Study plan | `GET /study-plan/me`; admin: `PUT /study-programs/{id}/plan` |
| Announcements, inbox | `GET/POST /announcements`, `GET /notifications`, `PUT /notifications/{id}/read`, `POST /notifications/read-all` |
| Admin: users | `GET/POST /users`, `PUT/DELETE /users/{id}` (`?mode=anonymize`) |
| Admin: organization, courses | `/departments`, `/study-programs`, `POST/DELETE /courses`, `POST /courses/{id}/restore` |
| Admin: reports, audit | `/reports/institution/overview`, `/reports/course/{id}`, `/reports/export`, `/audit-log` |
| Super admin: platform | `GET/PUT /institutions/{id}`, `PUT /institutions/{id}/status`, `GET /reports/platform/usage` |

## Local development (two terminals)

```bash
cd backend  && python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
            && cp .env.example .env && python -m app.seed && uvicorn app.main:app --reload     # :8000
cd frontend && npm run dev                                                                      # :5173, proxies /api
```

## Production (one server)

```bash
cd deploy && cp .env.example .env            # set SITE_ADDRESS, JWT_SECRET, SEED_ADMIN_PASSWORD
docker compose run --rm api python -m app.seed
docker compose up -d --build                 # Caddy obtains the TLS certificate automatically
```

Point the domain's DNS at the server first. Back up the `data` volume (SQLite file + uploads); the backup one-liner is at the bottom of `docker-compose.yml`.

## What was verified, and what was not

Verified here: backend test suite (25 tests); concurrency under 3 worker processes; the `Caddyfile` validates with Caddy 2.8.4 and, in a live run in front of the API, serves the SPA with deep-link fallback, long-cache for `/assets/*` and no-cache for `index.html`, forwards `/api` and `/health`, keeps unknown `/api` routes as JSON 404, rejects bodies over 12 MB (413) and passes the real client IP to the audit log; the frontend files type-check under strict TypeScript against React 19.
Not verified: the Docker images (no Docker in my environment), certificate issuance, the CI workflow on GitHub, and everything that touches your actual frontend code. I have not seen your `src/`, so the mock-data replacement (step 5) is the part that needs your repository. The CSP in the Caddyfile assumes the app loads nothing from other hosts; if something is blocked, the browser console names the directive to relax.
