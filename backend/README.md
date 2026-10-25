# EduCore backend (Python · FastAPI · SQLite)

REST API for the [EduCore frontend](https://github.com/Nemezida12811/EducorePrototype). Implements the AIS API spec sections 7.1–7.13 for a **single institution**, plus the endpoints the frontend needs that the written spec doesn't list (exam terms, timetable sessions, departments/programs, study plan, notification read state).

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2 + SQLite · Pydantic v2 · PyJWT (access) + rotating refresh tokens · bcrypt · TOTP 2FA (pyotp) · reportlab (PDF) · openpyxl (XLSX) · pytest.
Interactive API docs at **`/docs`** (disabled when `ENV=production`). JSON is camelCase to match the frontend.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # set JWT_SECRET (>= 32 chars)
python -m app.seed                                     # creates educore.db + demo data
uvicorn app.main:app --reload                          # http://localhost:8000/docs
```

Demo accounts (dev seed only; password = `SEED_ADMIN_PASSWORD`): `superadmin@`, `admin@`, `teacher1@`, `teacher2@`, `student1@`…`student3@educore.example`.
With `ENV=production` the seed creates only the institution and one super admin – **change that password immediately**.

```bash
pytest          # 25 integration tests on a throw-away SQLite file (schema + seed rebuilt every run)
docker compose run --rm api python -m app.seed && docker compose up -d
```

## SQLite: what to know

- **Concurrency is handled.** Check-then-write paths (enrollment capacity, waitlist promotion, grade entry) start with `BEGIN IMMEDIATE`, so they are serialized even across several uvicorn workers. Verified with 12 simultaneous enrollments on a 3-seat course across 3 worker processes: exactly 3 enrolled, 9 waitlisted, no lock errors. WAL mode and a 5 s busy timeout are enabled.
- **One machine, one volume.** SQLite is a single file; run one container/host with the DB and `STORAGE_DIR` on persistent storage. Back up with `sqlite3 educore.db ".backup backup.db"` (safe while running).
- **Schema changes:** tables are created on startup (`create_all`). That never alters existing tables – add **Alembic** once the schema starts evolving.
- Datetimes are stored as naive UTC and returned as ISO-8601 with `Z`. To move to PostgreSQL later, change `DATABASE_URL` (the code uses no SQLite-specific SQL beyond the connection setup in `app/db.py`).

## Endpoint coverage (`/api/v1`)

| Spec | Notes |
|---|---|
| 7.1 Auth | register, login, refresh (rotating, reuse detection), logout, password-reset (+`/confirm`), SSO google/microsoft, 2FA enable (two-step) & verify, sessions |
| 7.2 Users | me, me/export (GDPR), admin CRUD; `DELETE ?mode=deactivate\|anonymize` |
| 7.3 Institutions | operate on the single seeded institution; `POST` returns 409 |
| 7.4 Courses | filters, detail (teachers, sessions, prerequisites, documents, exams, own enrollment/grade), create/edit/archive (+`POST /:id/restore`), roster, PDF documents |
| 7.5 Enrollments | capacity check under write lock, waitlist with automatic promotion, prerequisite enforcement |
| 7.6 Grades | component points → final 0–100 → mark A–FX; history; PDF transcript |
| 7.7 Schedule | personal schedule, `.ics` export, academic calendar |
| 7.8 Notices | announcements fan out to in-app notifications; channel settings |
| 7.9 Files | quota-checked uploads, permission-checked downloads, certificate of study PDF |
| 7.10 Reports | overview, per-course stats, CSV/XLSX export, platform usage |
| 7.11 Audit | read-only list/detail; every mutation writes to it |
| 7.12 Billing | thin: subscription, invoices, signed gateway webhook (Stripe-style) |
| 7.13 Integrations | read-only API keys (`x-api-key`), signed webhooks (+ list/delete) |
| extra | `/exams`, `/courses/:id/sessions`, `/sessions/:id`, `/departments`, `/study-programs`, `/study-plan/me`, `/notifications/*` |

## Decisions you may want to revisit

- **Single institution** (your frontend README has no plans/per-institution split): limits (`maxUsers`, `maxStorageMb`) live on the one institution row and can't be set below current usage. Billing is deliberately thin.
- **Role names:** `student | teacher | admin | super_admin` (the UI says "Instructor"). `super_admin` passes every `admin` check.
- **Grading:** one grade per course; components come from `Course.gradingScheme` (must sum to 100); the final score is set only once every component has points. Marks: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, E ≥ 50, else FX – **adjust `mark_for` in `app/services.py` if yours differ**. The scheme is locked once grades exist; archived courses are read-only.
- **Public registration** is off by default and, when on, can only create students. SSO only signs in accounts that already exist.
- **API keys are read-only** and act with admin read access.
- Course/exam/program **updates change only the fields you send** (create applies defaults, update never does).

## Connecting the frontend

1. **HTTPS is mandatory** for the GitHub Pages site (browsers block mixed content). Host the API behind TLS and add the Pages origin to `CORS_ORIGINS` – it is `https://nemezida12811.github.io` (origin only, no `/EducorePrototype`).
2. Add `VITE_API_URL` to the frontend and a small client. Keep the access token in memory and refresh on 401:

```ts
// src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL + '/api/v1';
let access: string | null = null;
let refreshToken = sessionStorage.getItem('rt');   // trade-off: survives reload, readable by XSS

async function refresh() {
  if (!refreshToken) throw new Error('signed out');
  const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  if (!r.ok) { access = refreshToken = null; sessionStorage.removeItem('rt'); throw new Error('signed out'); }
  const t = await r.json(); access = t.accessToken; refreshToken = t.refreshToken; sessionStorage.setItem('rt', refreshToken!);
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}), ...init.headers } });
  if (r.status === 401 && retry && refreshToken) { await refresh(); return api<T>(path, init, false); }
  if (!r.ok) throw await r.json();
  return r.status === 204 ? (undefined as T) : r.json();
}
```

3. IDs are UUIDs, not the demo slugs (`ads2`, `oop`). List endpoints return `{ items, page, pageSize, total }`; errors are `{ error, message, details? }`.
4. Replace the role switcher with `user.role` from `POST /auth/login`.

## Security notes

bcrypt (cost 12, SHA-256 pre-hash so long passphrases aren't truncated), min 12 chars. Login/refresh/reset are rate-limited (in-memory, per process – use a reverse-proxy limiter if you scale out); login timing doesn't reveal whether an e-mail exists; reset requests always return 202. Refresh tokens are stored hashed, rotated on use, and reuse revokes all of the user's sessions. Uploads are size-capped, magic-byte checked, stored under random names and always served as attachments with `nosniff`. CSV/XLSX export neutralises spreadsheet formulas. Every mutation is audited.

## Not done / needs your input

- **E-mail and push delivery are stubs** (`notify_users` in `app/services.py`, password reset in `routers/auth.py`): in-app notifications work. In development the reset token is printed to the console.
- Files live on local disk (`STORAGE_DIR`); swap `save_file` for S3 if needed.
- SSO and the payment webhook follow the providers' documented formats but were not exercised against the real services (the webhook signature check is covered by tests).
- Webhook URLs get a basic SSRF guard (https, no internal hosts/IP literals); also restrict egress at the network layer.
- Exam-term *registration* by students isn't modelled yet (terms can be created, listed, closed).
