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

Pri prvom štarte kontajnera `api` sa automaticky vytvoria databázové tabuľky a naplnia sa testovacími údajmi (`python -m app.seed`). Ďalšie štarty nič nemenia (seed je idempotentný). Dáta zostávajú vo volume `data`; úplný reset: `docker compose down -v`.

### Nasadenie (KPI Coolify)

Používa sa súbor `compose.coolify.yaml` (build pack *Docker Compose*, *Docker compose location* `/compose.coolify.yaml`), ktorý nepublikuje porty hostiteľa. V Coolify nastavte premenné `JWT_SECRET` (min. 32 znakov) a `SEED_ADMIN_PASSWORD`, doménu pridajte na službu `web` (port 80). Voliteľné: `SEED_DEMO=false` vytvorí len super administrátora.

Nasadená aplikácia: https://voitiuk-educore.student.kpi.fei.tuke.sk

## Testovanie

**Automatické testy backendu** (46 testov, SQLite v dočasnom súbore):

```bash
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m pytest -q
```

Očakávaný výsledok: `46 passed`.

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

Hesla v `.env.example` sú len pre lokálne testovanie, v nasadení ich zmeňte.

## Ďalšia dokumentácia

- `INTEGRATION.md` – architektúra, zoznam zmien, nasadenie
- `backend/README.md` – popis API
