# EduCore backend (Python · FastAPI · SQLite)

REST API for the [EduCore frontend](https://github.com/Nemezida12811/EducorePrototype). Implements the AIS API spec sections 7.1–7.13 for a **single institution**, plus the endpoints the frontend needs that the written spec doesn't list (exam terms, timetable sessions, departments/programs, study plan, notification read state).

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2 + SQLite · Pydantic v2 · PyJWT (access) + rotating refresh tokens · bcrypt · TOTP 2FA (pyotp) · reportlab (PDF) · openpyxl (XLSX) · pytest.
Interactive API docs at **`/docs`** (disabled when `ENV=production`; the raw spec at `/openapi.json` stays available). JSON is camelCase to match the frontend.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                   # set JWT_SECRET (>= 32 chars)
python -m app.seed                                     # creates educore.db + demo data
uvicorn app.main:app --reload                          # http://localhost:8000/docs
```

Rooms: `GET /rooms` (everyone; filters `departmentId`, `kind`, `minCapacity`, `active`), `POST/PUT/DELETE /rooms` (admins). A room has a code, building, kind (`lecture_hall`, `classroom`, `lab`), seats and belongs to one or more departments. Timetable entries must use an active registered room that belongs to the course's department (a course without a department may use any room); the code is stored in the registered spelling, renaming a room renames it in timetables, and a room used in timetables can be deactivated but not deleted. **On a fresh production database no rooms exist: an administrator must add them before teachers can schedule sessions.**

The institution's 21 rooms live in `app/rooms_data.py` (kind and seats are estimates from the names, fix them under Rooms in the admin UI). Existing database: `python -m app.seed_rooms` adds them (each belonging to every department); `python -m app.seed_rooms --remap` also moves all timetable entries and exam terms onto them without clashes and deletes the old demo rooms nobody uses. Online rooms (`Virtual, Webex`, `Zasadačka online`) are never picked automatically.

Groups: a course has `groupCount` (1–10, default 1). A timetable entry has `groupNo`: `null` = every group attends, otherwise only that group. Each enrolled student gets one group automatically (the emptiest, lowest number on a tie); teachers and admins move students with `PUT /enrollments/{id}/group`. A student's schedule (and `.ics`) lists the sessions for all groups plus those of their own group. Lowering `groupCount` below a group that still has sessions is refused (`groups_in_use`); changing the count re-spreads students without a valid group.

Room assignment (`python -m app.seed_rooms --remap` and the form's "Suggest a free room"): each session gets the smallest suitable free room (a lab for lab work, never an online room) with at least as many seats as the students enrolled (per group for group sessions; the course limit while nobody has enrolled). Clashes of rooms and teachers only count inside one semester.

Drafts: a course has `status` (`draft` | `published`, default `published` for API clients). Drafts are visible only to the course's teachers and admins; students cannot see or enroll in them; a course with enrollments cannot go back to draft (`has_enrollments`). Enrollment in a published course is always open (there are no enrollment dates).

Schema upgrades: there is no migration tool yet, so `upgrade_schema()` (run at startup) adds missing nullable / defaulted columns to tables created by an older version. Anything bigger needs Alembic.

Bulk test data: `python -m app.seed_data [--students 150] [--seed 1]` adds ~150 students, 12 teachers, 4 departments, 5 programs with study plans, 26 courses with conflict-free timetables, prerequisites, grades, waitlists, exam terms and registrations, announcements and calendar dates (deterministic per `--seed`; refuses `ENV=production`; run once, delete `educore.db` to start over).

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
- **Grading:** one grade per course; components come from `Course.gradingScheme` (must sum to 100); the final score is set only once every component has points. Marks (Slovak ECTS-style, identical to the frontend): A ≥ 93, B ≥ 85, C ≥ 77, D ≥ 69, E ≥ 61, else FX – **adjust `mark_for` in `app/services.py` if yours differ**. Each component may have `minPoints`: a student below the minimum on any component gets FX whatever the total is (the frontend's builder expands "5 labs of 4 points" into `Lab 1`…`Lab 5`, up to 30 components). The scheme is locked once grades exist; archived courses are read-only.
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
- Exam terms: students register with `POST /exams/{id}/registration` (and cancel with `DELETE`); capacity, open/closed state, enrolment and a two-hour overlap rule are enforced. `GET /exams` returns `registered` and `registeredByMe`.
- Announcements carry a per-user read state: `read` and `unreadCount` in `GET /announcements`, `PUT|DELETE /announcements/{id}/read`, `POST /announcements/read-all`.
- Extra read endpoints for the frontend: `GET /teachers` (any signed-in user), `GET /institution` (name), `GET /schedule/all` (teachers/admins, for conflict checks). Creating or moving a session is rejected with `room_clash` / `teacher_clash` when it double-books a room or a teacher in the same semester.
- Practical *groups* (a student choosing one of several practical sessions) are not modelled: every non-lecture session of an enrolled course appears in the student's schedule.
