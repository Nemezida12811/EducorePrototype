# PROJEKTOVÁ ŠPECIFIKÁCIA

## 1. NÁZOV PROJEKTU

**EduCore – Akademický informačný systém**

Webová aplikácia pre správu študijnej agendy na vysokej škole, inšpirovaná systémom MAIS (Modulárny akademický informačný systém), navrhnutá ako semestrálny/ročníkový univerzitný projekt.

---

## 2. CIEĽ PROJEKTU

Cieľom projektu je navrhnúť a implementovať zjednodušený, no funkčne konzistentný akademický informačný systém, ktorý demonštruje schopnosť tímu (alebo jednotlivca s podporou AI nástrojov) navrhnúť viacvrstvovú webovú aplikáciu s reálnym doménovým modelom.

Systém má umožniť:
- študentom sledovať svoj študijný priebeh (zapísané predmety, rozvrh, známky, priemer),
- učiteľom spravovať predmety, zadávať známky a komunikovať so študentmi,
- administrátorom spravovať používateľov, predmety, akademický kalendár a organizačnú štruktúru fakulty.

Sekundárnym cieľom je preukázať schopnosť efektívne využívať AI nástroje (napr. Claude Code, GitHub Copilot) v celom vývojovom cykle – od návrhu architektúry cez generovanie kódu až po testovanie a dokumentáciu – pri zachovaní kontroly nad kvalitou a bezpečnosťou riešenia.

Projekt nie je určený na produkčné nasadenie na reálnej škole; ide o študijný prototyp demonštrujúci kľúčové princípy tvorby informačných systémov.

---

## 3. ROZSAH PROJEKTU

### V rozsahu (in scope)
- Registrácia a autentifikácia používateľov s rolami (študent, učiteľ, administrátor)
- Správa predmetov, sylabov a rozvrhu
- Zápis študentov na predmety (vrátane kapacitných limitov)
- Evidencia známok a hodnotení
- Zobrazenie študijných výsledkov a výpočet priemeru
- Akademický kalendár (skúškové obdobie, termíny zápisu)
- Jednoduchý systém oznamov/notifikácií
- Administrátorský panel na správu dát
- REST API dokumentované pomocou OpenAPI/Swagger
- Responzívne webové rozhranie (desktop + mobil)

### Mimo rozsahu (out of scope)
- Platobný/finančný modul (školné, štipendiá)
- Elektronický index s právnou záväznosťou a digitálnym podpisom
- Integrácia na štátne registre (napr. centrálny register študentov)
- Plnohodnotný LMS (nahrávanie výučbových materiálov, videokurzy)
- Mobilná natívna aplikácia (iOS/Android) – len responzívny web
- Viacjazyčnosť nad rámec slovenčiny/angličtiny (voliteľné rozšírenie)
- Vysoká dostupnosť, clustering, produkčné škálovanie

---

## 4. POUŽÍVATEĽSKÉ ROLY

| Rola | Popis | Hlavné oprávnenia |
|---|---|---|
| **Študent** | Zapísaný poslucháč programu | Prezeranie rozvrhu, zápis/odhlásenie z predmetov, prezeranie známok a priemeru, prijímanie oznamov, úprava vlastného profilu |
| **Učiteľ** | Vyučujúci predmetu (garant/cvičiaci) | Správa vlastných predmetov, zadávanie a úprava známok, tvorba oznamov pre svoje predmety, prezeranie zoznamu zapísaných študentov |
| **Administrátor** | Správca systému (študijné oddelenie) | Správa všetkých používateľov, predmetov, katedier, akademického kalendára, prideľovanie rolí, globálne nastavenia systému |
| **Anonymný návštevník** *(voliteľné)* | Nezriadený používateľ | Len prihlasovacia obrazovka, prípadne verejný zoznam predmetov |

Systém využíva **Role-Based Access Control (RBAC)** – každý endpoint a UI komponent kontroluje oprávnenia na základe roly prihláseného používateľa. Jeden používateľský účet môže mať práve jednu primárnu rolu (rozšírenie: viacero rolí naraz, napr. doktorand = študent + učiteľ).

---

## 5. ŠTRUKTÚROVANÉ FUNKČNÉ POŽIADAVKY

### 5.1 Autentifikácia a autorizácia
- FR-1.1: Používateľ sa prihlási pomocou e-mailu a hesla.
- FR-1.2: Systém generuje JWT prístupový token a refresh token.
- FR-1.3: Heslá sú uložené výhradne ako hash (bcrypt/argon2).
- FR-1.4: Administrátor vytvára účty pre učiteľov a študentov (alebo self-registrácia s doménovým e-mailom školy).
- FR-1.5: Systém podporuje zmenu a reset hesla (cez e-mailový token).

### 5.2 Správa používateľov (administrátor)
- FR-2.1: Administrátor vytvára, upravuje a deaktivuje používateľské účty.
- FR-2.2: Administrátor prideľuje/mení role používateľov.
- FR-2.3: Administrátor spravuje katedry a študijné programy.

### 5.3 Správa predmetov
- FR-3.1: Učiteľ/administrátor vytvára predmet (názov, kód, kredity, sylabus, kapacita).
- FR-3.2: Predmet je priradený ku katedre, garantovi a vyučujúcim.
- FR-3.3: Administrátor definuje rozvrhové akcie predmetu (prednáška, cvičenie – čas, miestnosť).
- FR-3.4: Systém eviduje predpoklady predmetu (prerekvizity) – voliteľné rozšírenie.

### 5.4 Zápis na predmety
- FR-4.1: Študent si zapisuje predmety v rámci zápisového obdobia definovaného kalendárom.
- FR-4.2: Systém kontroluje kapacitu predmetu a zabraňuje prekročeniu limitu.
- FR-4.3: Systém kontroluje kolízie v rozvrhu pri zápise.
- FR-4.4: Študent sa môže z predmetu odhlásiť do stanoveného termínu.

### 5.5 Hodnotenie a známky
- FR-5.1: Učiteľ zadáva čiastkové hodnotenia (napr. test, projekt) a záverečnú známku.
- FR-5.2: Systém automaticky počíta vážený študijný priemer študenta.
- FR-5.3: Študent vidí históriu známok za všetky semestre.
- FR-5.4: Systém generuje jednoduchý prehľad/výpis výsledkov (napr. export do PDF).

### 5.6 Rozvrh a kalendár
- FR-6.1: Systém zobrazuje osobný rozvrh študenta/učiteľa na základe zápisov.
- FR-6.2: Administrátor definuje akademický kalendár (semestre, skúškové obdobie, sviatky).
- FR-6.3: Systém upozorňuje na blížiace sa termíny (zápis, skúšky).

### 5.7 Oznamy a notifikácie
- FR-7.1: Učiteľ/administrátor publikuje oznamy viazané na predmet alebo celú školu.
- FR-7.2: Používateľ vidí zoznam relevantných oznamov po prihlásení.
- FR-7.3: *(voliteľné)* Notifikácie cez e-mail pri dôležitých udalostiach.

### 5.8 Profil používateľa
- FR-8.1: Používateľ upravuje osobné údaje (kontakt, profilová fotka).
- FR-8.2: Používateľ mení heslo priamo v nastaveniach účtu.

---

## 6. NEFUNKČNÉ POŽIADAVKY

| Kategória | Požiadavka |
|---|---|
| **Bezpečnosť** | HTTPS, hashované heslá, JWT s expiráciou, validácia vstupov, ochrana proti SQL injection a XSS, RBAC na úrovni API |
| **Výkon** | Odozva API pri bežných operáciách < 500 ms pri záťaži do 100 súbežných používateľov (postačuje pre demo/študijný účel) |
| **Použiteľnosť** | Intuitívne UI, responzívny dizajn (min. 360 px), podpora klávesovej navigácie |
| **Dostupnosť** | Cieľová dostupnosť 95 % počas prezentácie/testovania (nie produkčný SLA) |
| **Udržiavateľnosť** | Modulárna architektúra, jednotný štýl kódu (linter/formatter), pokrytie kľúčovej logiky unit testami |
| **Prenositeľnosť** | Kontajnerizácia pomocou Dockeru (frontend + backend + databáza) |
| **Škálovateľnosť** | Horizontálne škálovanie backendu nie je nutné pre MVP, ale architektúra by mu nemala brániť |
| **Lokalizácia** | Primárny jazyk slovenčina, štruktúra pripravená na i18n (voliteľné anglické rozhranie) |
| **Logovanie** | Základné logovanie chýb a kľúčových udalostí (prihlásenie, zmena známky) |
| **Dokumentácia** | README, API dokumentácia (OpenAPI), diagram architektúry a databázy |

---

## 7. API ŠPECIFIKÁCIA

REST API, formát JSON, autentifikácia cez `Authorization: Bearer <JWT>`. Odporúča sa generovať/udržiavať OpenAPI (Swagger) špecifikáciu priebežne počas vývoja – vhodné pre AI-asistovaný vývoj (generovanie klientskeho kódu, testov).

### 7.1 Autentifikácia
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/auth/register` | Registrácia nového používateľa | verejné/admin |
| POST | `/api/auth/login` | Prihlásenie, vráti access + refresh token | verejné |
| POST | `/api/auth/refresh` | Obnovenie access tokenu | prihlásený |
| POST | `/api/auth/logout` | Odhlásenie (invalidácia refresh tokenu) | prihlásený |
| POST | `/api/auth/password-reset` | Žiadosť o reset hesla | verejné |

### 7.2 Používatelia
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/users/me` | Profil prihláseného používateľa | všetky |
| PUT | `/api/users/me` | Úprava vlastného profilu | všetky |
| GET | `/api/users` | Zoznam používateľov (s filtrom podľa role) | admin |
| POST | `/api/users` | Vytvorenie používateľa | admin |
| PUT | `/api/users/{id}` | Úprava používateľa | admin |
| DELETE | `/api/users/{id}` | Deaktivácia používateľa | admin |

### 7.3 Predmety
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/courses` | Zoznam predmetov (s filtrom katedra/semester) | všetky |
| GET | `/api/courses/{id}` | Detail predmetu vrátane sylabu | všetky |
| POST | `/api/courses` | Vytvorenie predmetu | admin/učiteľ |
| PUT | `/api/courses/{id}` | Úprava predmetu | admin/garant |
| DELETE | `/api/courses/{id}` | Zrušenie predmetu | admin |
| GET | `/api/courses/{id}/students` | Zoznam zapísaných študentov | učiteľ/admin |

### 7.4 Zápisy
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/enrollments` | Zápis študenta na predmet | študent |
| DELETE | `/api/enrollments/{id}` | Odhlásenie z predmetu | študent |
| GET | `/api/enrollments/me` | Moje zapísané predmety | študent |

### 7.5 Známky
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/grades` | Zadanie/úprava známky | učiteľ |
| GET | `/api/grades/me` | Moje známky a priemer | študent |
| GET | `/api/grades/course/{courseId}` | Známky všetkých študentov predmetu | učiteľ |

### 7.6 Rozvrh a kalendár
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/schedule/me` | Osobný rozvrh | študent/učiteľ |
| GET | `/api/calendar/events` | Akademický kalendár | všetky |
| POST | `/api/calendar/events` | Vytvorenie udalosti (termín) | admin |

### 7.7 Oznamy
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/announcements` | Zoznam relevantných oznamov | všetky |
| POST | `/api/announcements` | Publikovanie oznamu | učiteľ/admin |

Chybové stavy jednotne vo formáte:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

---

## 8. DATABÁZOVÝ MODEL

### 8.1 Prehľad entít

- **User** (id, email, password_hash, first_name, last_name, role, is_active, created_at)
- **Department** (id, name, code)
- **StudyProgram** (id, name, department_id, degree_level)
- **Student** (id, user_id → User, study_program_id → StudyProgram, enrollment_year)
- **Teacher** (id, user_id → User, department_id → Department, title)
- **Course** (id, code, name, credits, capacity, department_id, guarantor_id → Teacher, semester, syllabus_text)
- **CourseTeacher** (course_id, teacher_id) – M:N väzba pre viacerých vyučujúcich
- **Enrollment** (id, student_id → Student, course_id → Course, enrolled_at, status [active/withdrawn])
- **Grade** (id, enrollment_id → Enrollment, grade_type [partial/final], value, weight, graded_at, graded_by → Teacher)
- **ScheduleEntry** (id, course_id → Course, day_of_week, start_time, end_time, room, type [lecture/seminar])
- **CalendarEvent** (id, title, type [enrollment_period/exam_period/holiday], start_date, end_date)
- **Announcement** (id, title, content, course_id → Course [nullable], author_id → User, created_at)

### 8.2 Entitno-relačný diagram (zjednodušene)

```
User (1)───(1) Student (1)───(N) Enrollment (N)───(1) Course (N)───(1) Department
User (1)───(1) Teacher (1)───(N) Course [ako garant]                     │
                                    │                                      │
                                    └───(N) ScheduleEntry                  │
Enrollment (1)───(N) Grade                                    StudyProgram (N)───(1) Department
Course (1)───(N) Announcement
```

### 8.3 Poznámky k návrhu
- Odporúča sa relačná databáza (PostgreSQL) kvôli silným väzbám medzi entitami a potrebe transakčnej konzistencie (napr. kapacita predmetu pri zápise).
- Kľúčové obmedzenia (unikátnosť e-mailu, kapacita predmetu, kolízie rozvrhu) je vhodné validovať na úrovni databázy aj aplikačnej logiky.
- Pre AI-asistovaný vývoj sa odporúča najprv navrhnúť tento model ako migračné skripty (napr. Prisma/TypeORM/Alembic), z ktorých AI nástroj následne generuje API vrstvu.

---

## 9. ODPORÚČANÝ PROCES VÝVOJA

Vzhľadom na to, že projekt je určený na vývoj najmä s podporou AI nástrojov, odporúča sa nasledovný iteratívny proces:

1. **Fáza návrhu (1–2 týždne)** – definícia požiadaviek, návrh databázového modelu, návrh API kontraktu (OpenAPI), wireframy UI.
2. **Nastavenie prostredia** – inicializácia repozitára, Docker prostredie, CI (lint + testy pri každom pushi).
3. **Iteratívny vývoj podľa modulov** (autentifikácia → predmety → zápisy → známky → rozvrh/kalendár → oznamy), kde každý modul obsahuje:
   - návrh dátovej vrstvy a API kontraktu,
   - generovanie kódu s pomocou AI (backend, frontend) na základe kontraktu,
   - manuálnu kontrolu a úpravu vygenerovaného kódu (code review),
   - napísanie/generovanie testov (unit + integračné),
   - nasadenie do testovacieho prostredia (Docker Compose).
4. **Priebežné testovanie** – manuálne testovanie UX tokov, automatizované testy API.
5. **Príprava na obhajobu** – dokumentácia, demo dáta (seed script), prezentácia.

Odporúča sa pracovať v krátkych iteráciách (1–2 týždne) s jasne definovaným výstupom (funkčný modul), keďže to umožňuje priebežne overovať kvalitu AI-generovaného kódu namiesto jeho hromadenia bez kontroly.

Verzovanie: Git s konvenciou feature branch + pull request, aj pri práci jednotlivca (uľahčuje code review AI-generovaného kódu).

---

## 10. TÍM

Realisticky navrhnuté pre tím **2–4 študentov** (funguje aj ako projekt jednotlivca s AI podporou, s predĺženým časovým odhadom):

| Rola | Zodpovednosť | Počet osôb |
|---|---|---|
| Backend vývojár | API, databáza, business logika, autentifikácia | 1 |
| Frontend vývojár | UI komponenty, integrácia s API, UX | 1 |
| Fullstack / DevOps | Docker, CI/CD, nasadenie, testovanie naprieč vrstvami | 1 |
| Analytik/dokumentátor *(voliteľné, môže byť zdieľaná rola)* | Špecifikácia, dokumentácia, príprava dát, prezentácia | 1 |

Pri menšom tíme (1–2 osoby) sa role kombinujú; AI nástroje čiastočne nahrádzajú kapacitu chýbajúcich špecializácií (napr. generovanie frontend komponentov backend vývojárom).

---

## 11. ČASOVÝ ODHAD

Odhad pre tím 2–3 osôb pracujúcich popri štúdiu (cca 8–10 h/týždeň/osoba), s využitím AI nástrojov na urýchlenie generovania kódu:

| Fáza | Trvanie |
|---|---|
| Analýza a návrh (špecifikácia, DB model, API kontrakt) | 1–2 týždne |
| Nastavenie prostredia a základnej architektúry | 1 týždeň |
| Modul: Autentifikácia a používatelia | 1–1,5 týždňa |
| Modul: Predmety a rozvrh | 1,5–2 týždne |
| Modul: Zápisy | 1 týždeň |
| Modul: Známky a hodnotenie | 1–1,5 týždňa |
| Modul: Oznamy a kalendár | 1 týždeň |
| Testovanie, oprava chýb, ladenie UX | 1,5–2 týždne |
| Dokumentácia a príprava prezentácie | 1 týždeň |
| **Spolu** | **~10–13 týždňov (jeden semester)** |

---

## 12. ODHAD CENY

Ide o študijný projekt bez komerčného nasadenia, cena je preto uvedená ako **orientačná trhová hodnota práce**, nie ako skutočný rozpočet:

| Položka | Odhad hodín | Sadzba (orientačne, junior dev.) | Cena (EUR) |
|---|---|---|---|
| Analýza a návrh | 30 h | 15 €/h | 450 € |
| Backend vývoj | 100 h | 15 €/h | 1 500 € |
| Frontend vývoj | 90 h | 15 €/h | 1 350 € |
| DevOps / nasadenie | 20 h | 15 €/h | 300 € |
| Testovanie a QA | 30 h | 15 €/h | 450 € |
| Dokumentácia | 15 h | 15 €/h | 225 € |
| **Spolu** | **~285 h** | | **~4 275 €** |

Pri efektívnom využití AI nástrojov na generovanie kódu je reálne skrátenie času vývoja o 20–40 %, čo predstavuje hlavný prínos skúmaný v rámci projektu. Prevádzkové náklady (hosting, doména) nie sú pre študijný projekt relevantné – postačuje lokálne alebo školské prostredie.

---

## 13. MVP (MINIMÁLNY ŽIVOTASCHOPNÝ PRODUKT)

MVP obsahuje minimálnu množinu funkcií nutných na demonštráciu konceptu:

1. Prihlásenie/odhlásenie pre 3 role (študent, učiteľ, admin)
2. Administrátor: vytvorenie predmetu a používateľa
3. Študent: zobrazenie zoznamu predmetov a zápis na predmet (s kontrolou kapacity)
4. Učiteľ: zadanie záverečnej známky zapísanému študentovi
5. Študent: zobrazenie svojich známok a vypočítaného priemeru
6. Základný responzívny dizajn (login, dashboard podľa role, detail predmetu)

Mimo MVP (nasleduje po ňom): rozvrh s kontrolou kolízií, oznamy, kalendár, export do PDF, notifikácie e-mailom.

---

## 14. RIZIKÁ A OBMEDZENIA

| Riziko | Vplyv | Opatrenie |
|---|---|---|
| Nadmerné spoliehanie sa na AI generovaný kód bez pochopenia logiky | Vysoký – chyby v business logike, bezpečnostné diery | Povinný code review každého AI-generovaného úseku, testy pred zlúčením |
| Podcenenie zložitosti zápisového procesu (kapacity, kolízie) | Stredný – oneskorenie harmonogramu | Vyhradiť extra čas na tento modul, jednoduchý dizajn v prvej iterácii |
| Nedostatočné testovanie bezpečnosti (autentifikácia, RBAC) | Vysoký – neoprávnený prístup k dátam | Explicitné testy oprávnení pre každú rolu, checklist pred odovzdaním |
| Časová tieseň v rámci semestra | Stredný | Prioritizácia MVP, škálovanie rozsahu podľa zostávajúceho času |
| Nekonzistentný dátový model po viacerých iteráciách | Stredný | Verzované DB migrácie, jeden zodpovedný člen za schému |
| Nejasné rozdelenie rolí v tíme | Nízky–stredný | Jasné pridelenie modulov na začiatku, pravidelný sync |
| Závislosť na dostupnosti AI nástrojov/API limitoch | Nízky | Lokálne zálohy kódu, nezávislosť kritickej logiky od behu AI služby |

**Obmedzenia:** Systém nie je určený na spracovanie reálnych osobných údajov študentov (GDPR compliance nie je predmetom projektu okrem základných princípov); výkonnostné a bezpečnostné požiadavky sú nastavené na úroveň primeranú školskému projektu, nie produkčnému systému.

---

## 15. NAVRHOVANÁ ARCHITEKTÚRA

### 15.1 Vysokoúrovňová architektúra

```
                             HTTPS/REST                                      SQL       
┌─────────────────────┐                      ┌────────────────────────┐                ┌────────────────┐
│      Frontend       │─────────────────────►│      Backend API       │───────────────►│   PostgreSQL   │
│   (React/Vue SPA)   │◄─────────────────────│    (Node.js/Express    │◄───────────────│                │
│                     │         JSON         │     alebo FastAPI)     │                │                │
└─────────────────────┘                      └────────────────────────┘                └────────────────┘
                                  │                                            │
                                  │                                            │
                                  ▼                                            ▼
                          Statický hosting                            JWT autentifikácia,
                        (napr. Nginx/Vercel)                           RBAC middleware,
                                                                           logovanie
```

### 15.2 Odporúčaný technologický stack

| Vrstva | Technológia | Poznámka |
|---|---|---|
| Frontend | React + TypeScript (alebo Vue 3) | Komponentová štruktúra, vhodná pre AI-generovanie |
| Stavovosť/UI | React Query/Zustand + Tailwind CSS (alebo obdobné) | Rýchly vývoj, konzistentný dizajn |
| Backend | Node.js/Express (alebo Python/FastAPI) | REST API, jednoduchá integrácia s AI nástrojmi |
| Databáza | PostgreSQL | Relačný model, silná konzistencia |
| ORM | Prisma/TypeORM (Node) alebo SQLAlchemy (Python) | Typované migrácie, dobrá čitateľnosť pre AI |
| Autentifikácia | JWT (access + refresh token) | Bez závislosti na externých IdP (voliteľne OAuth2) |
| Kontajnerizácia | Docker + Docker Compose | Samostatné kontajnery: frontend, backend, db |
| CI | GitHub Actions | Lint, testy pri každom pull requeste |
| Dokumentácia API | OpenAPI/Swagger UI | Generovaná zo zdrojového kódu alebo kontraktu |
| Testovanie | Jest/Vitest (frontend), Jest/PyTest (backend) | Unit + integračné testy kľúčových tokov |

### 15.3 Adresárová štruktúra projektu (podľa zadanej šablóny)

```
/frontend
  Dockerfile           # bude doplnený podľa zvolenej technológie (napr. Node + Nginx build)
  /src
/backend
  Dockerfile           # bude doplnený podľa zvolenej technológie (napr. Node/Python runtime)
  /src
/db
  /migrations
docker-compose.yml
README.md
```

---

## 16. ZÁVER

Navrhovaný systém **EduCore** predstavuje realistický, no zvládnuteľný rozsah projektu pre študentský tím na jeden semester. Špecifikácia zámerne obmedzuje rozsah na jadrové akademické procesy (autentifikácia, predmety, zápisy, hodnotenie, rozvrh, oznamy), aby bol projekt dokončiteľný v stanovenom čase a zároveň dostatočne komplexný na demonštráciu schopností tímu v oblasti návrhu architektúry, dátového modelovania a API dizajnu.

Dôraz na modulárny vývoj s jasne definovaným API kontraktom a databázovou schémou zároveň vytvára vhodné podmienky na efektívne využitie AI nástrojov počas celého vývojového cyklu – od generovania boilerplate kódu, cez testy, až po dokumentáciu – pri zachovaní zodpovednosti tímu za výslednú kvalitu a bezpečnosť riešenia.
