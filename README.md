---
app-url: https://voitiuk-educore.student.kpi.fei.tuke.sk
---

# EduCore – Akademický informačný systém

Webový akademický informačný systém: katalóg predmetov, zápis na predmety a čakacia listina, hodnotenie, rozvrh a skúšky, študijný plán, oznamy a notifikácie, administrácia používateľov a organizácie, reporty a audit. Roly: **študent, učiteľ, administrátor, super administrátor**.

## Architektúra

| Služba | Technológia | Popis |
|---|---|---|
| `web` | React 19, Vite, TypeScript, Tailwind + Caddy | Statické SPA, Caddy preposiela `/api/*`, `/health*` a `/openapi.json` na API |
| `api` | Python 3.12, FastAPI, SQLAlchemy | REST API (`/api/v1`), JWT + 2FA, generovanie PDF/XLSX |
| databáza | SQLite (volume `data`) | Súbor DB aj nahrané súbory ležia na jednom volume |

Prehliadač komunikuje len s `web` (jeden origin, bez CORS). Port API sa nepublikuje.

## Spustenie

Požiadavky: Docker s Docker Compose.

```bash
cp .env.example .env        # pre lokálne spustenie netreba nič upravovať
docker compose up --build
```

Aplikácia beží na **http://localhost:8080** (port zmeníte v `.env` cez `WEB_PORT`).

Pri prvom štarte kontajnera `api` sa automaticky vytvoria databázové tabuľky a naplnia sa testovacími údajmi (`python -m app.seed` a `python -m app.seed_data`: 100 študentov, každý so 4–5 aktívne zapísanými predmetmi, 30 učiteľov, 4 katedry, 5 študijných programov, 32 predmetov s rozvrhom bez kolízií, materiály predmetov (PDF), oznámenia a notifikácie; účty rýchleho prihlásenia (student1@, teacher1@) majú plnohodnotné údaje; ~90 % študentov, učiteľov, predmetov a rozvrhu patrí katedre KPI, známky, skúškové termíny a oznamy). Ďalšie štarty nič nemenia (seed je idempotentný). Dáta zostávajú vo volume `data`; úplný reset: `docker compose down -v`.

### Nasadenie (KPI Coolify)

Používa sa súbor `compose.coolify.yaml` (build pack *Docker Compose*, *Docker compose location* `/compose.coolify.yaml`), ktorý nepublikuje porty hostiteľa. V Coolify nastavte premenné `JWT_SECRET` (min. 32 znakov) a `SEED_ADMIN_PASSWORD`, doménu pridajte na službu `web` (port 80). Voliteľné: `SEED_DEMO=false` vytvorí len super administrátora.

Nasadená aplikácia: https://voitiuk-educore.student.kpi.fei.tuke.sk

## Testovanie

**Automatické testy** (bežia aj automaticky pri každom builde, pozri nižšie):

```bash
# backend: 80 testov (API, role a prístupové práva, známky, zápis, rýchle prihlásenie, health), SQLite v dočasnom súbore
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m pytest -q                                # očakávané: 80 passed

# frontend: 21 testov (prihlasovací formulár, rýchle prihlásenie, API klient: tokeny, refresh, chyby), Vitest + jsdom
cd frontend
npm ci
npm test                                           # očakávané: 21 passed
npx tsc --noEmit                                   # kontrola typov
```

**Testy pred nasadením.** Testy sú súčasťou Docker buildu: `backend/Dockerfile` má etapu `test` (spustí `pytest`) a `frontend/Dockerfile` spúšťa `npm test` pred `npm run build`. Ak niektorý test zlyhá, image sa nevytvorí a nasadenie (`docker compose up --build` aj Coolify) skončí chybou. Coolify odstráni staré kontajnery až po úspešnom builde, takže predchádzajúca verzia ďalej beží.

**Kontrola bežiaceho systému:**

| Požiadavka | Adresa | Očakávaný výsledok |
|---|---|---|
| Pripravenosť vrátane databázy | `/health/ready` | `200 {"status":"ok","database":"ok"}`; pri nedostupnej DB `503` |
| Živosť procesu | `/health` | `200 {"status":"ok"}` |
| Špecifikácia API (OpenAPI) | `/openapi.json` | JSON so špecifikáciou (77 ciest) |
| Aplikácia | `/` | prihlasovacia obrazovka |

Príklad: `curl http://localhost:8080/health/ready`

## Testovacie prihlasovacie údaje

Všetky účty majú heslo z premennej `SEED_ADMIN_PASSWORD` (v `.env.example`: `ChangeMe!12345`).

| Rola | E-mail |
|---|---|
| Super administrátor | `superadmin@educore.example` |
| Administrátor | `admin@educore.example` |
| Učiteľ | `teacher1@educore.example`, `teacher2@educore.example` |
| Študent | `student1@educore.example`, `student2@educore.example`, `student3@educore.example` |

Testovacie dáta: predmety OOP (archivovaný), ADS2 a DB1 (kapacita 2, `student3` je na čakacej listine), rozvrh, termín skúšky, študijný plán, oznam a udalosť v kalendári.

**Rýchle prihlásenie:** kým je `DEMO_LOGIN=true` (predvolené v `.env.example` aj v `compose.coolify.yaml`), prihlasovacia obrazovka zobrazí tlačidlá **Student**, **Teacher** a **Admin**, ktoré prihlásia testovací účet bez hesla (`student1@`, `teacher1@`, `admin@`). Super administrátor sa takto prihlásiť nedá. Po skončení testovania nastavte `DEMO_LOGIN=false` (v Coolify premenná prostredia a Deploy), tlačidlá aj endpointy `/api/v1/auth/demo-*` zmiznú.

Hesla v `.env.example` sú len pre lokálne testovanie, v nasadení ich zmeňte.

## Ďalšia dokumentácia

- `INTEGRATION.md` – architektúra, zoznam zmien, nasadenie
- `backend/README.md` – popis API
