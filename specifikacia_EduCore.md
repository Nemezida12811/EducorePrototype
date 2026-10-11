# PROJEKTOVÁ ŠPECIFIKÁCIA

## 1. NÁZOV PROJEKTU

**EduCore – Akademický informačný systém (SaaS platforma pre vysoké školy)**

EduCore je webová platforma pre správu študijnej agendy, inšpirovaná systémom MAIS, navrhnutá ako **komerčný multi-tenant produkt**, ktorý si môžu ako službu (SaaS) predplatiť viaceré vysoké školy alebo fakulty. Každá inštitúcia (tenant) má vlastné izolované dáta, vlastných používateľov a vlastnú konfiguráciu, pričom beží na spoločnej technickej infraštruktúre.

---

## 2. CIEĽ PROJEKTU

Cieľom projektu je vytvoriť produkčne pripravený akademický informačný systém, ktorý je možné komerčne prevádzkovať a predávať ako predplatenú službu viacerým vzdelávacím inštitúciám naraz.

Systém má umožniť:
- študentom sledovať svoj študijný priebeh (zapísané predmety, rozvrh, známky, priemer, dokumenty),
- učiteľom spravovať predmety, zadávať známky, komunikovať so študentmi a sledovať štatistiky svojich predmetov,
- administrátorom jednotlivých inštitúcií spravovať používateľov, predmety, akademický kalendár, organizačnú štruktúru a nastavenia svojej fakulty,
- prevádzkovateľovi platformy (Super Admin) spravovať jednotlivé inštitúcie ako zákazníkov, ich predplatné a globálne parametre systému.

Obchodným cieľom je overiť životaschopnosť produktu ako SaaS riešenia (opakovaný príjem z predplatného inštitúcií), pri zachovaní realistického rozsahu tak, aby bol vývoj zvládnuteľný definovaným tímom v stanovenom čase, okrem iného s podporou AI nástrojov na urýchlenie vývoja.

---

## 3. ROZSAH PROJEKTU

### V rozsahu (in scope)
- Multi-tenant architektúra – správa viacerých inštitúcií (fakúlt/škôl) v jednom systéme s dátovou izoláciou
- Registrácia a autentifikácia používateľov s rolami (študent, učiteľ, administrátor inštitúcie, super administrátor)
- Prihlásenie cez e-mail/heslo, voliteľne SSO (Google/Microsoft OAuth2) a dvojfaktorové overenie (2FA)
- Správa predmetov, sylabov a rozvrhu
- Zápis študentov na predmety (vrátane kapacitných limitov a kontroly kolízií)
- Evidencia známok a hodnotení, výpočet priemeru
- Akademický kalendár (skúškové obdobie, termíny zápisu)
- Systém oznamov a notifikácií (in-app, e-mail, voliteľne push)
- Správa dokumentov a súborov (sylaby, potvrdenia o štúdiu, prílohy k predmetom)
- Reporty a analytika (pre učiteľov a administrátorov inštitúcie)
- Audit log kľúčových akcií (zmena známky, zápis/odhlásenie, zmena oprávnení)
- Správa predplatného inštitúcie (plán, fakturačné údaje, aktivácia/deaktivácia)
- Prístup pre tretie strany cez API kľúče a webhooky (napr. napojenie na externý informačný systém školy)
- Administrátorský panel pre inštitúcie aj pre prevádzkovateľa platformy
- REST API dokumentované pomocou OpenAPI/Swagger, verzované (`/api/v1`)
- Responzívne webové rozhranie (desktop + mobil)

### Mimo rozsahu (out of scope)
- Spracovanie platieb školného/štipendií zo strany študentov (finančný modul pre koncového študenta)
- Elektronický index s právnou záväznosťou a kvalifikovaným digitálnym podpisom
- Priama integrácia na štátne registre (napr. centrálny register študentov)
- Plnohodnotný LMS (nahrávanie výučbových materiálov, videokurzy, testovacie nástroje)
- Natívna mobilná aplikácia (iOS/Android) – len responzívny web a verejné API pre budúcich klientov
- Automatizované penetračné testovanie a formálny bezpečnostný audit treťou stranou (odporúčané, ale mimo rozsahu prvej verzie)

---

## 4. POUŽÍVATEĽSKÉ ROLY

| Rola | Popis | Hlavné oprávnenia |
|---|---|---|
| **Študent** | Zapísaný poslucháč programu | Prezeranie rozvrhu, zápis/odhlásenie z predmetov, prezeranie známok a priemeru, dokumenty, prijímanie oznamov, úprava vlastného profilu |
| **Učiteľ** | Vyučujúci predmetu (garant/cvičiaci) | Správa vlastných predmetov, zadávanie a úprava známok, tvorba oznamov, prezeranie zoznamu zapísaných študentov, základné reporty za predmet |
| **Administrátor inštitúcie** | Správca systému na úrovni jednej školy/fakulty (študijné oddelenie) | Správa používateľov, predmetov, katedier, akademického kalendára, nastavení inštitúcie, reporty na úrovni inštitúcie |
| **Super administrátor (prevádzkovateľ)** | Správca celej SaaS platformy | Správa inštitúcií (tenantov), predplatného, globálnych nastavení, monitoring využívania, podpora zákazníkov |
| **Anonymný návštevník** *(voliteľné)* | Nezriadený používateľ | Prihlasovacia obrazovka, marketingová stránka produktu |

Systém využíva **Role-Based Access Control (RBAC)** kombinovaný s **tenant-scoped autorizáciou** – každý požiadavok na API je viazaný na konkrétnu inštitúciu (`tenant_id`) a rolu používateľa, čím je zaručená dátová izolácia medzi zákazníkmi.

---

## 5. ŠTRUKTÚROVANÉ FUNKČNÉ POŽIADAVKY

### 5.1 Autentifikácia a autorizácia
- FR-1.1: Používateľ sa prihlási pomocou e-mailu a hesla.
- FR-1.2: Systém generuje JWT prístupový token a refresh token.
- FR-1.3: Heslá sú uložené výhradne ako hash (bcrypt/argon2).
- FR-1.4: Administrátor vytvára účty pre učiteľov a študentov (alebo self-registrácia s doménovým e-mailom inštitúcie).
- FR-1.5: Systém podporuje zmenu a reset hesla (cez e-mailový token).
- FR-1.6: Systém podporuje voliteľné prihlásenie cez SSO (Google/Microsoft OAuth2).
- FR-1.7: Systém podporuje voliteľné dvojfaktorové overenie (2FA) pre administrátorské účty.
- FR-1.8: Systém automaticky odhlasuje používateľa po vypršaní platnosti relácie a umožňuje správu aktívnych relácií.

### 5.2 Správa používateľov a inštitúcií
- FR-2.1: Administrátor inštitúcie vytvára, upravuje a deaktivuje používateľské účty v rámci svojej inštitúcie.
- FR-2.2: Administrátor prideľuje/mení role používateľov v rámci svojej inštitúcie.
- FR-2.3: Administrátor spravuje katedry a študijné programy svojej inštitúcie.
- FR-2.4: Super administrátor vytvára a spravuje inštitúcie (tenantov) na platforme.
- FR-2.5: Super administrátor priraďuje predplatný plán a limity (počet používateľov, úložisko) jednotlivým inštitúciám.
- FR-2.6: Systém zabezpečuje, že dáta jednej inštitúcie nie sú nikdy prístupné inej inštitúcii (dátová izolácia).

### 5.3 Správa predmetov
- FR-3.1: Učiteľ/administrátor vytvára predmet (názov, kód, kredity, sylabus, kapacita).
- FR-3.2: Predmet je priradený ku katedre, garantovi a vyučujúcim.
- FR-3.3: Administrátor definuje rozvrhové akcie predmetu (prednáška, cvičenie – čas, miestnosť).
- FR-3.4: Systém eviduje predpoklady predmetu (prerekvizity).
- FR-3.5: Učiteľ nahráva sylabus a doplňujúce dokumenty k predmetu (napr. PDF).
- FR-3.6: Systém umožňuje archiváciu predmetov z predchádzajúcich akademických rokov (bez straty histórie).

### 5.4 Zápis na predmety
- FR-4.1: Študent si zapisuje predmety v rámci zápisového obdobia definovaného kalendárom.
- FR-4.2: Systém kontroluje kapacitu predmetu a zabraňuje prekročeniu limitu.
- FR-4.3: Systém kontroluje kolízie v rozvrhu pri zápise.
- FR-4.4: Študent sa môže z predmetu odhlásiť do stanoveného termínu.
- FR-4.5: Systém eviduje čakaciu listinu (waitlist), ak je predmet obsadený, a automaticky ponúkne miesto pri uvoľnení kapacity.

### 5.5 Hodnotenie a známky
- FR-5.1: Učiteľ zadáva čiastkové hodnotenia (napr. test, projekt) a záverečnú známku.
- FR-5.2: Systém automaticky počíta vážený študijný priemer študenta.
- FR-5.3: Študent vidí históriu známok za všetky semestre.
- FR-5.4: Systém generuje prehľad/výpis výsledkov ako PDF dokument s hlavičkou inštitúcie.
- FR-5.5: Systém eviduje históriu zmien známky (kto a kedy známku zmenil) pre účely auditu.

### 5.6 Rozvrh a kalendár
- FR-6.1: Systém zobrazuje osobný rozvrh študenta/učiteľa na základe zápisov.
- FR-6.2: Administrátor definuje akademický kalendár (semestre, skúškové obdobie, sviatky) pre svoju inštitúciu.
- FR-6.3: Systém upozorňuje na blížiace sa termíny (zápis, skúšky) prostredníctvom notifikácií.
- FR-6.4: Systém umožňuje export osobného rozvrhu do externého kalendára (formát iCal).

### 5.7 Oznamy a notifikácie
- FR-7.1: Učiteľ/administrátor publikuje oznamy viazané na predmet, katedru alebo celú inštitúciu.
- FR-7.2: Používateľ vidí zoznam relevantných oznamov po prihlásení (in-app notifikačné centrum).
- FR-7.3: Systém odosiela e-mailové notifikácie pri kľúčových udalostiach (nová známka, schválenie zápisu, blížiaci sa termín).
- FR-7.4: Používateľ si v nastaveniach volí, ktoré typy notifikácií chce dostávať a akým kanálom (in-app/e-mail).
- FR-7.5: *(voliteľné rozšírenie)* Push notifikácie pre mobilné prehliadače (Web Push).

### 5.8 Profil používateľa
- FR-8.1: Používateľ upravuje osobné údaje (kontakt, profilová fotka).
- FR-8.2: Používateľ mení heslo priamo v nastaveniach účtu.
- FR-8.3: Používateľ si stiahne export vlastných osobných údajov (v súlade s princípmi GDPR).

### 5.9 Správa dokumentov a súborov
- FR-9.1: Systém umožňuje nahrávanie a ukladanie súborov (sylaby, prílohy, potvrdenia) do objektového úložiska.
- FR-9.2: Prístup k súboru je kontrolovaný rolou a príslušnosťou k inštitúcii/predmetu.
- FR-9.3: Systém validuje typ a veľkosť nahrávaného súboru a kontroluje ho na škodlivý obsah.
- FR-9.4: Administrátor generuje potvrdenie o štúdiu ako PDF dokument na požiadanie študenta.

### 5.10 Reporty a analytika
- FR-10.1: Administrátor inštitúcie vidí súhrnné štatistiky (počet študentov, obsadenosť predmetov, priemerné hodnotenia).
- FR-10.2: Učiteľ vidí štatistiky úspešnosti študentov vo svojom predmete (rozloženie známok, priemer).
- FR-10.3: Systém umožňuje export reportov do CSV/Excel.
- FR-10.4: Super administrátor vidí agregované metriky využívania platformy naprieč inštitúciami (bez prístupu k citlivým študijným dátam).

### 5.11 Audit log a compliance
- FR-11.1: Systém eviduje audit log kľúčových akcií (prihlásenie, zmena známky, zmena oprávnení, export dát) s časovou pečiatkou a identitou vykonávateľa.
- FR-11.2: Administrátor inštitúcie má prístup k auditnému logu vlastnej inštitúcie.
- FR-11.3: Systém umožňuje vymazanie/anonymizáciu osobných údajov používateľa na žiadosť (right to erasure).

### 5.12 Správa predplatného a fakturácie (inštitúcia ako zákazník)
- FR-12.1: Super administrátor priraďuje inštitúcii predplatný plán (napr. Basic/Pro) s definovanými limitmi.
- FR-12.2: Systém sleduje využitie limitov inštitúcie (počet aktívnych používateľov, úložisko) a upozorňuje pri ich prekročení.
- FR-12.3: Systém eviduje fakturačné údaje inštitúcie a históriu vystavených faktúr (integrácia na fakturačný/platobný nástroj tretej strany, napr. Stripe).
- FR-12.4: Administrátor inštitúcie vidí prehľad svojho predplatného a stav platby.

### 5.13 Integrácie a prístup tretích strán
- FR-13.1: Administrátor inštitúcie generuje API kľúče pre externé systémy (napr. prepojenie na existujúci školský informačný systém).
- FR-13.2: Systém podporuje webhooky pri vybraných udalostiach (napr. nová známka, nový zápis) pre integráciu s externými nástrojmi.
- FR-13.3: Prístup cez API kľúč je obmedzený rate-limitingom a rozsahom oprávnení (scopes).

---

## 6. NEFUNKČNÉ POŽIADAVKY

| Kategória | Požiadavka |
|---|---|
| **Bezpečnosť** | HTTPS, hashované heslá, JWT s krátkou expiráciou + refresh token rotácia, validácia vstupov, ochrana proti SQL injection a XSS, RBAC + tenant izolácia na úrovni API, šifrovanie citlivých dát v databáze |
| **Výkon** | Odozva API pri bežných operáciách < 300 ms (p95) pri záťaži do 1 000 súbežných používateľov naprieč inštitúciami |
| **Použiteľnosť** | Intuitívne UI, responzívny dizajn (min. 360 px), podpora klávesovej navigácie, konzistentný design systém |
| **Dostupnosť** | Cieľová dostupnosť 99,5 % (SLA pre platený plán), monitorovaný pomocou uptime nástroja |
| **Škálovateľnosť** | Horizontálne škálovanie backendu, oddelenie stavovej a bezstavovej vrstvy, podpora rastúceho počtu inštitúcií bez degradácie výkonu |
| **Multi-tenancy** | Logická alebo fyzická izolácia dát medzi inštitúciami, konfigurovateľné limity podľa predplatného plánu |
| **Udržiavateľnosť** | Modulárna architektúra, jednotný štýl kódu (linter/formatter), pokrytie kľúčovej logiky unit a integračnými testami (min. 70 % pre business logiku) |
| **Prenositeľnosť** | Kontajnerizácia pomocou Dockeru (frontend, backend, databáza, cache, worker) |
| **Pozorovateľnosť (observability)** | Centralizované logovanie, error tracking (napr. Sentry), metriky a alerting (napr. Prometheus/Grafana) |
| **Zálohovanie a obnova** | Pravidelné automatizované zálohy databázy, definovaný RPO/RTO pre obnovu po havárii |
| **Lokalizácia** | Podpora slovenčiny a angličtiny s možnosťou pridania ďalších jazykov pre nové inštitúcie |
| **Súlad s GDPR** | Evidencia súhlasov, export a výmaz osobných údajov, retenčné politiky pre audit log |
| **Dokumentácia** | README, API dokumentácia (OpenAPI), diagram architektúry a databázy, prevádzková príručka (runbook) |

---

## 7. API ŠPECIFIKÁCIA

REST API, formát JSON, verzované pod `/api/v1`, autentifikácia cez `Authorization: Bearer <JWT>` (alebo `X-API-Key` pre integrácie tretích strán). Všetky požiadavky sú implicitne viazané na inštitúciu prihláseného používateľa (tenant scoping). Zoznamové endpointy podporujú stránkovanie (`?page=&limit=`), filtrovanie a triedenie (`?sort=`). API je limitované rate-limitingom (predvolene 100 req/min na klienta, konfigurovateľné podľa plánu).

### 7.1 Autentifikácia
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Registrácia nového používateľa | verejné/admin |
| POST | `/api/v1/auth/login` | Prihlásenie, vráti access + refresh token | verejné |
| POST | `/api/v1/auth/refresh` | Obnovenie access tokenu | prihlásený |
| POST | `/api/v1/auth/logout` | Odhlásenie (invalidácia refresh tokenu) | prihlásený |
| POST | `/api/v1/auth/password-reset` | Žiadosť o reset hesla | verejné |
| POST | `/api/v1/auth/sso/{provider}` | Prihlásenie cez externého poskytovateľa (Google/Microsoft) | verejné |
| POST | `/api/v1/auth/2fa/enable` | Aktivácia dvojfaktorového overenia | prihlásený |
| POST | `/api/v1/auth/2fa/verify` | Overenie 2FA kódu pri prihlásení | prihlásený |
| GET | `/api/v1/auth/sessions` | Zoznam aktívnych relácií používateľa | prihlásený |

### 7.2 Používatelia
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/users/me` | Profil prihláseného používateľa | všetky |
| PUT | `/api/v1/users/me` | Úprava vlastného profilu | všetky |
| GET | `/api/v1/users/me/export` | Export vlastných osobných údajov (GDPR) | všetky |
| GET | `/api/v1/users` | Zoznam používateľov (filter, stránkovanie) | admin |
| POST | `/api/v1/users` | Vytvorenie používateľa | admin |
| PUT | `/api/v1/users/{id}` | Úprava používateľa | admin |
| DELETE | `/api/v1/users/{id}` | Deaktivácia/anonymizácia používateľa | admin |

### 7.3 Inštitúcie (tenanti) – Super Admin
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/institutions` | Zoznam inštitúcií na platforme | super admin |
| POST | `/api/v1/institutions` | Vytvorenie novej inštitúcie | super admin |
| GET | `/api/v1/institutions/{id}` | Detail inštitúcie vrátane plánu a limitov | super admin |
| PUT | `/api/v1/institutions/{id}` | Úprava nastavení/plánu inštitúcie | super admin |
| PUT | `/api/v1/institutions/{id}/status` | Aktivácia/pozastavenie inštitúcie | super admin |

### 7.4 Predmety
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/courses` | Zoznam predmetov (filter katedra/semester) | všetky |
| GET | `/api/v1/courses/{id}` | Detail predmetu vrátane sylabu | všetky |
| POST | `/api/v1/courses` | Vytvorenie predmetu | admin/učiteľ |
| PUT | `/api/v1/courses/{id}` | Úprava predmetu | admin/garant |
| DELETE | `/api/v1/courses/{id}` | Zrušenie/archivácia predmetu | admin |
| GET | `/api/v1/courses/{id}/students` | Zoznam zapísaných študentov | učiteľ/admin |
| POST | `/api/v1/courses/{id}/documents` | Nahratie dokumentu k predmetu | učiteľ/admin |

### 7.5 Zápisy
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/v1/enrollments` | Zápis študenta na predmet | študent |
| DELETE | `/api/v1/enrollments/{id}` | Odhlásenie z predmetu | študent |
| GET | `/api/v1/enrollments/me` | Moje zapísané predmety | študent |
| GET | `/api/v1/courses/{id}/waitlist` | Zoznam čakajúcich na predmet | učiteľ/admin |

### 7.6 Známky
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/v1/grades` | Zadanie/úprava známky | učiteľ |
| GET | `/api/v1/grades/me` | Moje známky a priemer | študent |
| GET | `/api/v1/grades/course/{courseId}` | Známky všetkých študentov predmetu | učiteľ |
| GET | `/api/v1/grades/{id}/history` | História zmien konkrétnej známky | učiteľ/admin |
| GET | `/api/v1/grades/me/transcript` | Výpis výsledkov ako PDF | študent |

### 7.7 Rozvrh a kalendár
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/schedule/me` | Osobný rozvrh | študent/učiteľ |
| GET | `/api/v1/schedule/me/export` | Export rozvrhu do formátu iCal | študent/učiteľ |
| GET | `/api/v1/calendar/events` | Akademický kalendár | všetky |
| POST | `/api/v1/calendar/events` | Vytvorenie udalosti (termín) | admin |

### 7.8 Oznamy a notifikácie
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/announcements` | Zoznam relevantných oznamov | všetky |
| POST | `/api/v1/announcements` | Publikovanie oznamu | učiteľ/admin |
| GET | `/api/v1/notifications` | Notifikačné centrum používateľa | všetky |
| PUT | `/api/v1/notifications/settings` | Nastavenie preferovaných kanálov notifikácií | všetky |

### 7.9 Súbory a dokumenty
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| POST | `/api/v1/files` | Nahratie súboru do úložiska | prihlásený |
| GET | `/api/v1/files/{id}` | Stiahnutie súboru (s kontrolou oprávnení) | prihlásený |
| DELETE | `/api/v1/files/{id}` | Zmazanie súboru | admin/vlastník |
| POST | `/api/v1/documents/transcript-request` | Vygenerovanie potvrdenia o štúdiu | študent |

### 7.10 Reporty a analytika
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/reports/institution/overview` | Súhrnné štatistiky inštitúcie | admin |
| GET | `/api/v1/reports/course/{id}` | Štatistiky úspešnosti predmetu | učiteľ/admin |
| GET | `/api/v1/reports/export` | Export reportu do CSV/Excel | admin |
| GET | `/api/v1/reports/platform/usage` | Agregované metriky využitia platformy | super admin |

### 7.11 Audit log
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/audit-log` | Zoznam auditných záznamov inštitúcie (filter, stránkovanie) | admin |
| GET | `/api/v1/audit-log/{id}` | Detail auditného záznamu | admin |

### 7.12 Predplatné a fakturácia
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/billing/subscription` | Detail aktuálneho predplatného inštitúcie | admin |
| PUT | `/api/v1/billing/subscription` | Zmena plánu predplatného | super admin |
| GET | `/api/v1/billing/invoices` | História faktúr inštitúcie | admin |
| POST | `/api/v1/billing/webhook` | Prijatie webhooku od platobnej brány (napr. Stripe) | interné/systémové |

### 7.13 Integrácie (API kľúče a webhooky)
| Metóda | Endpoint | Popis | Rola |
|---|---|---|---|
| GET | `/api/v1/integrations/api-keys` | Zoznam API kľúčov inštitúcie | admin |
| POST | `/api/v1/integrations/api-keys` | Vygenerovanie nového API kľúča | admin |
| DELETE | `/api/v1/integrations/api-keys/{id}` | Zneplatnenie API kľúča | admin |
| POST | `/api/v1/integrations/webhooks` | Registrácia webhook endpointu | admin |

Chybové stavy jednotne vo formáte:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "requestId": "..." } }
```

---

## 8. DATABÁZOVÝ MODEL

Databázový model je navrhnutý **pre jednu univerzitu** (žiadny `Institution`/tenant koncept) a presne zodpovedá doménovému modelu implementovanému v sekcii 9 — každá tabuľka tu zodpovedá práve jednej doménovej triede, bez duplicitných alebo konfliktných entít.

### 8.1 Prehľad entít

- **User** (id, email, password_hash, first_name, last_name, role, is_active, created_at)
- **Student** (id → User, student_number, study_program_id → StudyProgram, enrollment_year)
- **Teacher** (id → User, employee_number, title, org_unit_id → OrgUnit)
- **OrgUnit** (id, name, code, parent_id → OrgUnit) — hierarchia fakulta → katedra v rámci jednej univerzity
- **StudyProgram** (id, name, degree_level, duration_years, org_unit_id → OrgUnit)
- **Course** (id, code, name, description, credits, completion_type, grading_scheme [JSON], org_unit_id → OrgUnit) — katalógový záznam predmetu vrátane konfigurácie zloženia hodnotenia
- **StudyPlanItem** (id, study_program_id → StudyProgram, course_id → Course, year_of_study, term_type, is_mandatory)
- **Semester** (id, academic_year, term_type, start_date, end_date, enrollment_start, enrollment_end, exam_period_start, exam_period_end)
- **CourseOffering** (id, course_id → Course, semester_id → Semester, capacity) — konkrétna realizácia predmetu v semestri
- **CourseTeacher** (id, course_offering_id → CourseOffering, teacher_id → Teacher, is_guarantor) — M:N väzba, umožňuje **viacerých vyučujúcich** na jednej ponuke predmetu
- **Enrollment** (id, student_id → Student, course_offering_id → CourseOffering, status [active/withdrawn/waitlisted], enrolled_at)
- **Grade** (id, student_id → Student, course_id → Course, final_score [0–100], components [JSON], graded_at) — **UNIQUE(student_id, course_id)**: práve jedno hodnotenie na predmet pre študenta
- **ScheduleEntry** (id, course_offering_id → CourseOffering, day_of_week, start_time, end_time, room, entry_type)
- **ExamTerm** (id, course_offering_id → CourseOffering, date, start_time, room, capacity)
- **ExamRegistration** (id, student_id → Student, exam_term_id → ExamTerm, status [registered/attended/cancelled], registered_at)

### 8.2 Entitno-relačný diagram (zjednodušene)

```
OrgUnit (1)──(N) Teacher
OrgUnit (1)──(N) StudyProgram ──(1:N) StudyPlanItem (N)──(1) Course
OrgUnit (1)──(N) Course

User (1)──(1) Student ──(N:1) StudyProgram
User (1)──(1) Teacher

Course (1)──(N) CourseOffering ──(N:1) Semester
CourseOffering (N)──(N) Teacher            [cez CourseTeacher, is_guarantor]
CourseOffering (1)──(N) ScheduleEntry
CourseOffering (1)──(N) ExamTerm (1)──(N) ExamRegistration ──(N:1) Student

Student (1)──(N) Enrollment ──(N:1) CourseOffering
Student (1)──(N) Grade ──(N:1) Course       [UNIQUE (student_id, course_id)]
```

### 8.3 Poznámky k návrhu

- **Jedna univerzita:** systém neobsahuje žiadny `Institution`/tenant koncept ani `institution_id` stĺpec. `OrgUnit` modeluje len internú organizačnú štruktúru tejto jednej univerzity (fakulty, katedry) — nie viacero samostatných inštitúcií.
- **Hodnotenie (Grade):** `Course.grading_scheme` (napr. `{"Assignments": 20, "Test": 20, "Exam": 60}`) definuje, z akých zložiek a s akým maximom bodov sa skladá výsledné hodnotenie predmetu. `Grade.components` nesie skutočne dosiahnuté body za tie isté zložky (napr. `{"Assignments": 18, "Test": 17, "Exam": 55}`) a `Grade.final_score` je ich súčet v rozsahu 0–100. Súčet `grading_scheme` musí byť presne 100 a žiadna zložka v `components` nesmie prekročiť svoje maximum — tieto pravidlá sú vynucované na aplikačnej/doménovej úrovni (sekcia 9), keďže ich nemožno spoľahlivo vyjadriť ako jednoduché DB obmedzenie nad JSON stĺpcom.
- **UNIQUE(student_id, course_id)** na `Grade` zaručuje presne jedno hodnotenie na predmet pre študenta; prípadné opakovanie predmetu v inom semestri (nová `CourseOffering`/`Enrollment`) vedie k prepísaniu existujúceho záznamu `Grade`, história pokusov sa samostatne needeviduje (mimo rozsahu MVP).
- **UNIQUE(course_offering_id, teacher_id)** na `CourseTeacher` umožňuje tímovú výučbu — ľubovoľný počet vyučujúcich na jednej ponuke predmetu, pričom `is_guarantor` označuje garanta predmetu.
- Odporúča sa relačná databáza (PostgreSQL) s JSON/JSONB stĺpcami pre `grading_scheme` a `components`, kvôli silným väzbám medzi entitami a potrebe transakčnej konzistencie (napr. kapacita pri zápise, kapacita skúškového termínu).
- Pre AI-asistovaný vývoj sa odporúča generovať migračné skripty v **Alembic** priamo zo SQLAlchemy modelov v sekcii 9 — tie sú jediným zdrojom pravdy pre schému, aby nemohlo dôjsť k opätovnému rozídeniu databázového a doménového modelu.

---

## 9. DOMÉNOVÝ MODEL

### 9.1 Princípy a rozsah modelu

Doménový model opisuje jednoinštitučný akademický informačný systém (podobne ako MAIS) pre **jednu univerzitu** — bez multi-tenancy, predplatného/fakturácie, API kľúčov pre tretie strany, správy súborov a auditného logu. Model obsahuje nasledujúcich **15 doménových tried**:

`User` (so subtriedami `Student` a `Teacher`), `OrgUnit`, `StudyProgram`, `Course`, `StudyPlanItem`, `Semester`, `CourseOffering`, `CourseTeacher`, `Enrollment`, `Grade`, `ScheduleEntry`, `ExamTerm`, `ExamRegistration`.

Administrátor nemá vlastnú doménovú triedu — je to inštancia `User` s rolou `ADMIN`, keďže nenesie žiadne doménovo špecifické správanie navyše oproti základnej identite (na rozdiel od študenta a učiteľa, ktorí majú vlastné dáta a zodpovednosti).

**Grade** je samostatná doménová trieda: nesie výsledné hodnotenie (`final_score`, 0–100 bodov) a jeho rozpis podľa zložiek definovaných v `Course.grading_scheme` (napr. *Zadania – 20 b., Test – 20 b., Skúška – 60 b.*). Väzba je priamo na dvojicu (`Student`, `Course`) s obmedzením **práve jeden `Grade` na predmet pre študenta** — nezávisle od toho, v ktorom semestri/`CourseOffering` predmet absolvoval. `ExamTerm`/`ExamRegistration` naďalej riešia len logistiku skúškového termínu (prihlásenie, kapacita, účasť); samotné body za skúšku sa zapisujú ako jedna zo zložiek v `Grade.components`.

**CourseTeacher** je asociačná trieda medzi `CourseOffering` a `Teacher`, ktorá umožňuje, aby na jednej ponuke predmetu v danom semestri vyučovalo **viacero učiteľov** súčasne (napr. prednášajúci + cvičiaci), s príznakom `is_guarantor` pre garanta predmetu.

### 9.2 Prehľad doménových tried

| Trieda | Kľúčové atribúty | Vzťahy | Zodpovednosť |
|---|---|---|---|
| **User** *(báza)* | email, password_hash, first_name, last_name, role, is_active | — | Identita a autentifikácia; spoločný základ pre `Student` a `Teacher` (aj priama reprezentácia administrátora) |
| **Student** *(extends User)* | student_number, enrollment_year | N:1 `StudyProgram`; 1:N `Enrollment`, `Grade`, `ExamRegistration` | Vlastní svoje zápisy, hodnotenia a registrácie na skúšky; počíta vlastný vážený priemer |
| **Teacher** *(extends User)* | employee_number, title | N:1 `OrgUnit`; N:N `CourseOffering` (cez `CourseTeacher`) | Vyučuje (prípadne spoluvyučuje) konkrétne ponuky predmetov v danom semestri |
| **OrgUnit** | name, code | self-ref (parent/children); 1:N `Teacher`, `StudyProgram`, `Course` | Hierarchická organizačná jednotka jednej univerzity (fakulta → katedra) |
| **StudyProgram** | name, degree_level, duration_years | N:1 `OrgUnit`; 1:N `Student`, `StudyPlanItem` | Definuje študijný program a jeho učebný plán |
| **Course** | code, name, description, credits, completion_type, grading_scheme | N:1 `OrgUnit`; 1:N `StudyPlanItem`, `CourseOffering`, `Grade` | Katalógový záznam predmetu vrátane konfigurácie zloženia výsledného hodnotenia |
| **StudyPlanItem** | year_of_study, term_type, is_mandatory | N:1 `StudyProgram`; N:1 `Course` | Zaraďuje predmet do učebného plánu programu (ročník, semester, povinnosť) |
| **Semester** | academic_year, term_type, start/end_date, enrollment_start/end, exam_period_start/end | 1:N `CourseOffering` | Časové vymedzenie akademického obdobia a kľúčových termínov |
| **CourseOffering** | capacity | N:1 `Course`, `Semester`; N:N `Teacher` (cez `CourseTeacher`); 1:N `Enrollment`, `ScheduleEntry`, `ExamTerm` | Konkrétna realizácia predmetu v danom semestri; stráži kapacitu zápisu |
| **CourseTeacher** | is_guarantor | N:1 `CourseOffering`; N:1 `Teacher` | Priraďuje (jedného či viacerých) vyučujúcich k ponuke predmetu, označuje garanta |
| **Enrollment** | status, enrolled_at | N:1 `Student`, `CourseOffering` | Zápis študenta na ponuku predmetu; riadi životný cyklus (aktívny/odhlásený/čakajúci) |
| **Grade** | final_score (0–100), components | N:1 `Student`; N:1 `Course` — **UNIQUE(student, course)** | Nesie výsledné hodnotenie predmetu a jeho rozpis podľa zložiek z `Course.grading_scheme` |
| **ScheduleEntry** | day_of_week, start_time, end_time, room, entry_type | N:1 `CourseOffering` | Pravidelný rozvrhový blok (prednáška/cvičenie/laboratórium) |
| **ExamTerm** | date, start_time, room, capacity | N:1 `CourseOffering`; 1:N `ExamRegistration` | Konkrétny termín skúšky s vlastnou kapacitou |
| **ExamRegistration** | status, registered_at | N:1 `Student`, `ExamTerm` | Prihlásenie na termín skúšky a evidencia účasti (bez bodového výsledku — ten nesie `Grade`) |

### 9.3 Implementácia v SQLAlchemy 2.0 (Python)

```python
# domain/models.py
"""Doménový model akademického informačného systému EduCore (jedna univerzita)."""

from __future__ import annotations

import enum
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import JSON
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enumy
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class CompletionType(str, enum.Enum):
    EXAM = "exam"                          # skúška
    CREDIT = "credit"                      # zápočet
    CREDIT_AND_EXAM = "credit_and_exam"    # zápočet a skúška


class TermType(str, enum.Enum):
    WINTER = "winter"
    SUMMER = "summer"


class EnrollmentStatus(str, enum.Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    WAITLISTED = "waitlisted"


class ScheduleEntryType(str, enum.Enum):
    LECTURE = "lecture"
    SEMINAR = "seminar"
    LAB = "lab"


class ExamRegistrationStatus(str, enum.Enum):
    REGISTERED = "registered"
    ATTENDED = "attended"
    CANCELLED = "cancelled"


# ---------------------------------------------------------------------------
# User, Student, Teacher — spoločná identita (joined-table dedičnosť)
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole))
    is_active: Mapped[bool] = mapped_column(default=True)

    __mapper_args__ = {"polymorphic_on": "role", "polymorphic_identity": UserRole.ADMIN}

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Student(User):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    student_number: Mapped[str] = mapped_column(String(20), unique=True)
    study_program_id: Mapped[int] = mapped_column(ForeignKey("study_programs.id"))
    enrollment_year: Mapped[int]

    __mapper_args__ = {"polymorphic_identity": UserRole.STUDENT}

    study_program: Mapped["StudyProgram"] = relationship(back_populates="students")
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="student")
    grades: Mapped[list["Grade"]] = relationship(back_populates="student")
    exam_registrations: Mapped[list["ExamRegistration"]] = relationship(back_populates="student")

    def calculate_average(self) -> Decimal | None:
        """Vážený priemer z final_score všetkých ohodnotených predmetov (váha = kredity predmetu)."""
        graded = [(g.final_score, g.course.credits) for g in self.grades]
        if not graded:
            return None
        total_credits = sum(credits for _, credits in graded)
        if total_credits == 0:
            return None
        weighted_sum = sum(score * credits for score, credits in graded)
        return round(weighted_sum / total_credits, 2)


class Teacher(User):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    employee_number: Mapped[str] = mapped_column(String(20), unique=True)
    title: Mapped[str | None] = mapped_column(String(50))
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"))

    __mapper_args__ = {"polymorphic_identity": UserRole.TEACHER}

    org_unit: Mapped["OrgUnit"] = relationship(back_populates="teachers")
    offering_links: Mapped[list["CourseTeacher"]] = relationship(back_populates="teacher")

    @property
    def course_offerings(self) -> list["CourseOffering"]:
        return [link.course_offering for link in self.offering_links]


# ---------------------------------------------------------------------------
# Organizačná a študijná štruktúra
# ---------------------------------------------------------------------------

class OrgUnit(Base):
    """Hierarchická organizačná jednotka jednej univerzity (napr. fakulta → katedra)."""
    __tablename__ = "org_units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("org_units.id"))

    parent: Mapped["OrgUnit | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["OrgUnit"]] = relationship(back_populates="parent")
    teachers: Mapped[list["Teacher"]] = relationship(back_populates="org_unit")
    study_programs: Mapped[list["StudyProgram"]] = relationship(back_populates="org_unit")
    courses: Mapped[list["Course"]] = relationship(back_populates="org_unit")


class StudyProgram(Base):
    __tablename__ = "study_programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    degree_level: Mapped[str] = mapped_column(String(20))   # Bc. / Ing. / PhD.
    duration_years: Mapped[int]
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"))

    org_unit: Mapped["OrgUnit"] = relationship(back_populates="study_programs")
    students: Mapped[list["Student"]] = relationship(back_populates="study_program")
    plan_items: Mapped[list["StudyPlanItem"]] = relationship(back_populates="study_program")


class Course(Base):
    """Katalógový záznam predmetu vrátane konfigurácie zloženia výsledného hodnotenia."""
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(String(2000))
    credits: Mapped[int]
    completion_type: Mapped[CompletionType] = mapped_column(SQLEnum(CompletionType))
    grading_scheme: Mapped[dict] = mapped_column(JSON)
    # napr. {"Assignments": 20, "Test": 20, "Exam": 60} — súčet musí byť 100
    org_unit_id: Mapped[int] = mapped_column(ForeignKey("org_units.id"))

    org_unit: Mapped["OrgUnit"] = relationship(back_populates="courses")
    plan_items: Mapped[list["StudyPlanItem"]] = relationship(back_populates="course")
    offerings: Mapped[list["CourseOffering"]] = relationship(back_populates="course")
    grades: Mapped[list["Grade"]] = relationship(back_populates="course")

    def is_valid_grading_scheme(self) -> bool:
        """Doménové pravidlo: súčet maximálnych bodov všetkých zložiek musí byť presne 100."""
        return sum(self.grading_scheme.values()) == 100


class StudyPlanItem(Base):
    """Zaradenie predmetu do učebného plánu konkrétneho študijného programu."""
    __tablename__ = "study_plan_items"
    __table_args__ = (UniqueConstraint("study_program_id", "course_id", name="uq_plan_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    study_program_id: Mapped[int] = mapped_column(ForeignKey("study_programs.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    year_of_study: Mapped[int]
    term_type: Mapped[TermType] = mapped_column(SQLEnum(TermType))
    is_mandatory: Mapped[bool] = mapped_column(default=True)

    study_program: Mapped["StudyProgram"] = relationship(back_populates="plan_items")
    course: Mapped["Course"] = relationship(back_populates="plan_items")


# ---------------------------------------------------------------------------
# Semester, CourseOffering, CourseTeacher
# ---------------------------------------------------------------------------

class Semester(Base):
    __tablename__ = "semesters"

    id: Mapped[int] = mapped_column(primary_key=True)
    academic_year: Mapped[str] = mapped_column(String(9))   # napr. "2026/2027"
    term_type: Mapped[TermType] = mapped_column(SQLEnum(TermType))
    start_date: Mapped[date]
    end_date: Mapped[date]
    enrollment_start: Mapped[date]
    enrollment_end: Mapped[date]
    exam_period_start: Mapped[date]
    exam_period_end: Mapped[date]

    offerings: Mapped[list["CourseOffering"]] = relationship(back_populates="semester")

    @property
    def is_enrollment_open(self) -> bool:
        today = date.today()
        return self.enrollment_start <= today <= self.enrollment_end


class CourseOffering(Base):
    """Konkrétna realizácia predmetu (Course) v danom semestri, s kapacitou a tímom vyučujúcich."""
    __tablename__ = "course_offerings"
    __table_args__ = (UniqueConstraint("course_id", "semester_id", name="uq_offering_per_semester"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    semester_id: Mapped[int] = mapped_column(ForeignKey("semesters.id"))
    capacity: Mapped[int]

    course: Mapped["Course"] = relationship(back_populates="offerings")
    semester: Mapped["Semester"] = relationship(back_populates="offerings")
    teacher_links: Mapped[list["CourseTeacher"]] = relationship(back_populates="course_offering")
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="course_offering")
    schedule_entries: Mapped[list["ScheduleEntry"]] = relationship(back_populates="course_offering")
    exam_terms: Mapped[list["ExamTerm"]] = relationship(back_populates="course_offering")

    @property
    def teachers(self) -> list["Teacher"]:
        return [link.teacher for link in self.teacher_links]

    @property
    def guarantor(self) -> "Teacher | None":
        return next((link.teacher for link in self.teacher_links if link.is_guarantor), None)

    @property
    def active_enrollment_count(self) -> int:
        return sum(1 for e in self.enrollments if e.status == EnrollmentStatus.ACTIVE)

    @property
    def is_full(self) -> bool:
        """Doménové pravidlo: ponuka predmetu je plná, keď aktívne zápisy dosiahnu kapacitu."""
        return self.active_enrollment_count >= self.capacity

    @property
    def available_seats(self) -> int:
        return max(self.capacity - self.active_enrollment_count, 0)


class CourseTeacher(Base):
    """Priraďuje (jedného či viacerých) vyučujúcich k ponuke predmetu; umožňuje tímovú výučbu."""
    __tablename__ = "course_teachers"
    __table_args__ = (UniqueConstraint("course_offering_id", "teacher_id", name="uq_offering_teacher"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_offering_id: Mapped[int] = mapped_column(ForeignKey("course_offerings.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    is_guarantor: Mapped[bool] = mapped_column(default=False)

    course_offering: Mapped["CourseOffering"] = relationship(back_populates="teacher_links")
    teacher: Mapped["Teacher"] = relationship(back_populates="offering_links")


# ---------------------------------------------------------------------------
# Enrollment, Grade, ScheduleEntry
# ---------------------------------------------------------------------------

class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("student_id", "course_offering_id", name="uq_student_offering"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    course_offering_id: Mapped[int] = mapped_column(ForeignKey("course_offerings.id"))
    status: Mapped[EnrollmentStatus] = mapped_column(SQLEnum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE)
    enrolled_at: Mapped[datetime] = mapped_column(server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="enrollments")
    course_offering: Mapped["CourseOffering"] = relationship(back_populates="enrollments")

    @classmethod
    def enroll(cls, student: "Student", offering: "CourseOffering") -> "Enrollment":
        """Zapíše študenta; ak je ponuka plná, zaradí ho na čakaciu listinu namiesto priameho zápisu."""
        status = EnrollmentStatus.WAITLISTED if offering.is_full else EnrollmentStatus.ACTIVE
        return cls(student=student, course_offering=offering, status=status)

    def withdraw(self) -> None:
        self.status = EnrollmentStatus.WITHDRAWN


class Grade(Base):
    """
    Výsledné hodnotenie predmetu pre študenta (0–100 bodov), zložené z komponentov
    definovaných v `Course.grading_scheme`. Väzba (student, course) je unikátna —
    práve jedno hodnotenie na predmet pre študenta, bez ohľadu na to, v ktorom
    semestri/CourseOffering bol predmet absolvovaný.
    """
    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_grade_per_student_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    final_score: Mapped[Decimal] = mapped_column(Numeric(5, 2))   # 0.00–100.00
    components: Mapped[dict] = mapped_column(JSON)
    # napr. {"Assignments": 18, "Test": 17, "Exam": 55} — dosiahnuté body po zložkách
    graded_at: Mapped[datetime] = mapped_column(server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="grades")
    course: Mapped["Course"] = relationship(back_populates="grades")

    def recalculate_final_score(self) -> None:
        """Prepočíta final_score zo zložiek a overí ich voči Course.grading_scheme."""
        scheme = self.course.grading_scheme
        for component, points in self.components.items():
            max_points = scheme.get(component)
            if max_points is None:
                raise ValueError(f"Neznáma zložka hodnotenia: {component}")
            if points > max_points:
                raise ValueError(f"Zložka '{component}' presahuje maximum {max_points} bodov.")
        total = sum(Decimal(str(points)) for points in self.components.values())
        if not (Decimal("0") <= total <= Decimal("100")):
            raise ValueError("Výsledné hodnotenie musí byť v rozsahu 0–100.")
        self.final_score = total


class ScheduleEntry(Base):
    """Pravidelný rozvrhový blok (prednáška/cvičenie/laboratórium) danej ponuky predmetu."""
    __tablename__ = "schedule_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_offering_id: Mapped[int] = mapped_column(ForeignKey("course_offerings.id"))
    day_of_week: Mapped[int]            # 0 = pondelok … 6 = nedeľa
    start_time: Mapped[time]
    end_time: Mapped[time]
    room: Mapped[str] = mapped_column(String(50))
    entry_type: Mapped[ScheduleEntryType] = mapped_column(SQLEnum(ScheduleEntryType), default=ScheduleEntryType.LECTURE)

    course_offering: Mapped["CourseOffering"] = relationship(back_populates="schedule_entries")


# ---------------------------------------------------------------------------
# ExamTerm, ExamRegistration
# ---------------------------------------------------------------------------

class ExamTerm(Base):
    """Konkrétny termín skúšky vypísaný k ponuke predmetu, s vlastnou kapacitou."""
    __tablename__ = "exam_terms"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_offering_id: Mapped[int] = mapped_column(ForeignKey("course_offerings.id"))
    date: Mapped[date]
    start_time: Mapped[time]
    room: Mapped[str] = mapped_column(String(50))
    capacity: Mapped[int]

    course_offering: Mapped["CourseOffering"] = relationship(back_populates="exam_terms")
    registrations: Mapped[list["ExamRegistration"]] = relationship(back_populates="exam_term")

    @property
    def registered_count(self) -> int:
        return sum(1 for r in self.registrations if r.status != ExamRegistrationStatus.CANCELLED)

    @property
    def has_available_seat(self) -> bool:
        return self.registered_count < self.capacity


class ExamRegistration(Base):
    """
    Prihlásenie študenta na termín skúšky a evidencia účasti — čisto logistická
    záležitosť (kedy, kde). Bodový výsledok skúšky je jednou zo zložiek v Grade.components,
    nie atribútom tejto triedy.
    """
    __tablename__ = "exam_registrations"
    __table_args__ = (UniqueConstraint("student_id", "exam_term_id", name="uq_student_exam_term"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    exam_term_id: Mapped[int] = mapped_column(ForeignKey("exam_terms.id"))
    status: Mapped[ExamRegistrationStatus] = mapped_column(
        SQLEnum(ExamRegistrationStatus), default=ExamRegistrationStatus.REGISTERED
    )
    registered_at: Mapped[datetime] = mapped_column(server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="exam_registrations")
    exam_term: Mapped["ExamTerm"] = relationship(back_populates="registrations")

    @classmethod
    def register(cls, student: "Student", exam_term: "ExamTerm") -> "ExamRegistration":
        """Doménové pravidlo: prihlásenie je možné len na termín s voľnou kapacitou."""
        if not exam_term.has_available_seat:
            raise ValueError("Termín skúšky je plne obsadený.")
        return cls(student=student, exam_term=exam_term)

    def mark_attended(self) -> None:
        self.status = ExamRegistrationStatus.ATTENDED
```

### 9.4 Príklad použitia doménovej logiky

```python
# application/academic_service.py
from decimal import Decimal

from sqlalchemy.orm import Session

from domain.models import CourseOffering, Enrollment, ExamRegistration, ExamTerm, Grade, Student


def enroll_student(db: Session, student: Student, offering: CourseOffering) -> Enrollment:
    """Zápis na predmet; kapacitné pravidlo (aktívny zápis / waitlist) rieši Enrollment.enroll()."""
    enrollment = Enrollment.enroll(student=student, offering=offering)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def register_for_exam(db: Session, student: Student, exam_term: ExamTerm) -> ExamRegistration:
    """Prihlásenie na skúšku; kapacitné pravidlo rieši ExamRegistration.register()."""
    registration = ExamRegistration.register(student=student, exam_term=exam_term)
    db.add(registration)
    db.commit()
    db.refresh(registration)
    return registration


def submit_grade(db: Session, student: Student, course_id: int, components: dict[str, Decimal]) -> Grade:
    """
    Zapíše/aktualizuje výsledné hodnotenie predmetu pre študenta podľa zložiek
    (napr. {"Assignments": 18, "Test": 17, "Exam": 55}). final_score sa dopočíta
    a overí voči Course.grading_scheme v recalculate_final_score().
    """
    grade = next((g for g in student.grades if g.course_id == course_id), None)
    if grade is None:
        grade = Grade(student=student, course_id=course_id, components=components, final_score=Decimal("0"))
        db.add(grade)
    else:
        grade.components = components

    grade.recalculate_final_score()
    db.commit()
    db.refresh(grade)
    return grade
```

---


## 10. ODPORÚČANÝ PROCES VÝVOJA

Odporúča sa **Scrum** s dvojtýždňovými šprintmi, doplnený o praktiky vhodné pre AI-asistovaný vývoj:

1. **Discovery a špecifikácia (2–3 týždne)** – zber požiadaviek, definícia perzón (študent/učiteľ/admin/super admin), návrh databázového modelu, návrh API kontraktu (OpenAPI), wireframy a dizajn systém.
2. **Nastavenie prostredia** – inicializácia repozitára (monorepo alebo oddelené repozitáre), Docker prostredie, CI/CD pipeline (lint, testy, build pri každom pushi), oddelené prostredia dev/staging/production.
3. **Iteratívny vývoj v šprintoch podľa modulov** – postupné dodávanie: autentifikácia a multi-tenancy → predmety a rozvrh → zápisy → známky → notifikácie a dokumenty → reporty a audit log → predplatné a integrácie. Každý šprint obsahuje:
   - spresnenie zadania a akceptačných kritérií (backlog refinement),
   - návrh dátovej vrstvy a API kontraktu pred implementáciou,
   - generovanie kódu s pomocou AI nástrojov (backend, frontend) na základe kontraktu,
   - povinný code review vygenerovaného aj ručne písaného kódu,
   - písanie/generovanie unit a integračných testov,
   - nasadenie do staging prostredia a demo na konci šprintu (sprint review).
4. **Testovanie a QA** – manuálne testovanie kritických tokov, automatizované API testy, testovanie výkonu pri simulovanej záťaži viacerých inštitúcií súčasne.
5. **Bezpečnostná kontrola** – interný security review (OWASP Top 10 checklist), kontrola tenant izolácie.
6. **User Acceptance Testing (UAT)** – overenie s pilotnou inštitúciou pred ostrým nasadením.
7. **Nasadenie do produkcie a stabilizácia** – monitoring, zber spätnej väzby, oprava kritických chýb (hypercare fáza).

Verzovanie: Git s konvenciou feature branch + pull request + povinný review pred zlúčením do hlavnej vetvy.

---

## 11. TÍM

Realistické zloženie tímu pre komerčný vývoj produktu tejto veľkosti (menší produktový tím, s využitím AI nástrojov na zrýchlenie implementácie):

| Rola | Zodpovednosť | Počet osôb |
|---|---|---|
| Product Owner | Definícia požiadaviek, priorizácia backlogu, komunikácia so zákazníkmi (pilotnými inštitúciami) | 1 |
| Projektový/Scrum manažér | Plánovanie šprintov, koordinácia tímu, reporting stavu projektu | 1 |
| Backend vývojár (senior) | Architektúra API, multi-tenancy, business logika, autentifikácia, integrácie | 1 |
| Backend vývojár (medior/junior) | Implementácia modulov podľa zadania, testy | 1 |
| Frontend vývojár (senior) | Architektúra UI, dizajn systém, kľúčové obrazovky | 1 |
| Frontend vývojár (medior/junior) | Implementácia komponentov, integrácia s API | 1 |
| UX/UI dizajnér | Návrh používateľských tokov, wireframy, dizajn systém, prototypy | 1 |
| DevOps/SRE inžinier | CI/CD, infraštruktúra, monitoring, zálohovanie, škálovanie | 1 |
| QA inžinier | Testovacia stratégia, manuálne aj automatizované testy, regresné testovanie | 1 |
| Bezpečnostný špecialista *(čiastočný úväzok/konzultant)* | Security review, kontrola tenant izolácie, GDPR súlad | 0,5 |
| Technický spisovateľ/Business analytik | Dokumentácia, API špecifikácia, podpora pri UAT | 0,5 |

**Spolu: ~9,5 FTE** (plný pracovný úväzok). Pri menšom rozpočte je možné kombinovať role (napr. Product Owner + Scrum manažér, alebo Frontend/Backend senior developer preberajúci aj časť DevOps zodpovednosti); nasadenie AI nástrojov v takom prípade čiastočne kompenzuje nižší počet ľudí, najmä pri implementácii opakovaných CRUD modulov.

---

## 12. ČASOVÝ ODHAD

Odhad pre tím popísaný v sekcii 10, pracujúci na plný úväzok, s využitím AI nástrojov na urýchlenie generovania kódu a testov:

| Fáza | Trvanie |
|---|---|
| Discovery, špecifikácia, UX/UI dizajn | 3 týždne |
| Nastavenie architektúry, CI/CD, prostredí | 2 týždne |
| Šprint: Autentifikácia, multi-tenancy, správa používateľov a inštitúcií | 3 týždne |
| Šprint: Predmety, rozvrh, katedry a programy | 3 týždne |
| Šprint: Zápisy (vrátane waitlistu) | 2 týždne |
| Šprint: Známky, história zmien, transcript PDF | 2,5 týždňa |
| Šprint: Notifikácie, oznamy, správa dokumentov | 2,5 týždňa |
| Šprint: Reporty, analytika, audit log | 2 týždne |
| Šprint: Predplatné/fakturácia a integrácie tretích strán | 2,5 týždňa |
| Testovanie, výkonové a bezpečnostné testy | 2,5 týždňa |
| UAT s pilotnou inštitúciou a úpravy | 2 týždne |
| Nasadenie do produkcie a stabilizačná (hypercare) fáza | 2 týždne |
| **Spolu** | **~29–30 týždňov (cca 7 mesiacov)** |

---

## 13. ODHAD CENY

Odhad je uvedený ako orientačná trhová cena vývoja na strednej/východoeurópskej sadzbovej úrovni (nezahŕňa DPH):

| Rola | Odhad hodín | Sadzba (EUR/h) | Cena (EUR) |
|---|---|---|---|
| Product Owner | 220 h | 35 €/h | 7 700 € |
| Projektový/Scrum manažér | 220 h | 30 €/h | 6 600 € |
| Backend vývojár (senior) | 950 h | 45 €/h | 42 750 € |
| Backend vývojár (medior) | 900 h | 30 €/h | 27 000 € |
| Frontend vývojár (senior) | 900 h | 42 €/h | 37 800 € |
| Frontend vývojár (medior) | 850 h | 28 €/h | 23 800 € |
| UX/UI dizajnér | 350 h | 32 €/h | 11 200 € |
| DevOps/SRE inžinier | 400 h | 38 €/h | 15 200 € |
| QA inžinier | 500 h | 26 €/h | 13 000 € |
| Bezpečnostný špecialista (konzultácia) | 100 h | 55 €/h | 5 500 € |
| Technický spisovateľ/analytik | 150 h | 24 €/h | 3 600 € |
| **Vývoj spolu** | **~5 540 h** | | **~194 150 €** |

**Prevádzkové a ostatné náklady (odhad na prvý rok):**

| Položka | Odhad (EUR/rok) |
|---|---|
| Cloudová infraštruktúra (hosting, databáza, úložisko, CDN) | 3 600 – 7 200 € |
| Monitoring, logovanie, error tracking (SaaS nástroje) | 1 200 – 2 400 € |
| Platobná brána a fakturačný nástroj (transakčné poplatky) | podľa objemu tržieb |
| Licencie a nástroje (dizajn, projektový manažment, CI/CD) | 1 500 – 3 000 € |
| Podpora a údržba po nasadení (retainer, cca 15–20 % vývojových nákladov ročne) | ~29 000 – 39 000 € |

**Celkový odhadovaný rozpočet prvého roka (vývoj + prevádzka + podpora): cca 230 000 – 250 000 €.**

Pri efektívnom využití AI nástrojov na generovanie kódu, testov a dokumentácie je reálny potenciál skrátenia vývojových hodín o 20–35 %, čo pri tomto rozsahu predstavuje úsporu rádovo desiatok tisíc eur – toto zrýchlenie je jedným z kľúčových overovaných prínosov projektu.

---

## 14. MVP (MINIMÁLNY ŽIVOTASCHOPNÝ PRODUKT)

MVP obsahuje minimálnu množinu funkcií nutných na demonštráciu konceptu:

1. Prihlásenie/odhlásenie pre 3 role (študent, učiteľ, admin)
2. Administrátor: vytvorenie predmetu a používateľa
3. Študent: zobrazenie zoznamu predmetov a zápis na predmet (s kontrolou kapacity)
4. Učiteľ: zadanie záverečnej známky zapísanému študentovi
5. Študent: zobrazenie svojich známok a vypočítaného priemeru
6. Základný responzívny dizajn (login, dashboard podľa role, detail predmetu)

Mimo MVP (nasleduje po ňom): rozvrh s kontrolou kolízií, oznamy, kalendár, export do PDF, notifikácie e-mailom.

---

## 15. RIZIKÁ A OBMEDZENIA

| Riziko | Vplyv | Opatrenie |
|---|---|---|
| Nadmerné spoliehanie sa na AI generovaný kód bez pochopenia logiky | Vysoký – chyby v business logike, bezpečnostné diery | Povinný code review každého AI-generovaného úseku, testy pred zlúčením |
| Chyba v tenant izolácii (únik dát medzi inštitúciami) | Kritický – strata dôvery zákazníkov, právne dôsledky | Automatizované testy izolácie, review každého dotazu na `institution_id` filter, voliteľne Row-Level Security |
| Podcenenie zložitosti zápisového procesu (kapacity, kolízie, waitlist) | Stredný – oneskorenie harmonogramu | Vyhradiť extra čas na tento modul, jednoduchý dizajn v prvej iterácii |
| Nedostatočné testovanie bezpečnosti (autentifikácia, RBAC, API kľúče) | Vysoký – neoprávnený prístup k dátam | Interný security review, penetračné testovanie pred väčším komerčným nasadením |
| Nesúlad s GDPR pri spracovaní osobných údajov viacerých inštitúcií | Vysoký – právne a reputačné riziko | Právna konzultácia, implementácia exportu/výmazu dát, retenčné politiky |
| Závislosť na externých poskytovateľoch (platobná brána, e-mailová služba, cloud) | Stredný – výpadok tretej strany ovplyvní dostupnosť | Zmluvné SLA s dodávateľmi, plán zálohovania kritických integrácií |
| Nízka adopcia zo strany pilotných inštitúcií | Stredný – ohrozenie obchodnej udržateľnosti | Skoré zapojenie pilotného zákazníka do UAT, iteratívna spätná väzba |
| Časová tieseň a rozpočtové obmedzenia | Stredný | Prioritizácia MVP, fázované rozširovanie funkcií po prvom nasadení |
| Nekonzistentný dátový model po viacerých iteráciách | Stredný | Verzované DB migrácie, jeden zodpovedný člen (backend senior) za schému |

**Obmedzenia:** Systém v prvej verzii nezahŕňa formálny externý bezpečnostný audit ani spracovanie platieb koncových študentov; tieto oblasti sú odporúčané ako súčasť ďalšej fázy pred plnohodnotným komerčným nasadením vo väčšom rozsahu.

---

## 16. NAVRHOVANÁ ARCHITEKTÚRA

### 16.1 Vysokoúrovňová architektúra

```
                             HTTPS/REST                                      SQL       
┌─────────────────────┐                      ┌────────────────────────┐                ┌────────────────┐
│      Frontend       │─────────────────────►│      Backend API       │───────────────►│   PostgreSQL   │
│  (React + TS SPA)   │◄─────────────────────│       (FastAPI)        │◄───────────────│                │
│                     │         JSON         │     (Python 3.12)      │                │                │
└─────────────────────┘                      └────────────────────────┘                └────────────────┘
                                  │                                            │
                                  │                                            │
                                  ▼                                            ▼
                          Statický hosting                            JWT autentifikácia,
                        (napr. Nginx/Vercel)                           RBAC middleware,
                                                                           logovanie
```

Pre komerčnú prevádzku je backend doplnený o ďalšie komponenty (nezobrazené v základnom diagrame, aby zostal prehľadný): **cache/queue vrstvu** (Redis – session cache, rate limiting, asynchrónne odosielanie notifikácií), **objektové úložisko** (S3-kompatibilné – sylaby, dokumenty, transcripty), **e-mailovú/notifikačnú službu** (napr. SendGrid/SES), **platobnú bránu** (napr. Stripe – fakturácia inštitúcií) a **monitoring stack** (error tracking, metriky, alerting).

### 16.2 Finálny technologický stack

Technologický stack bol zúžený z pôvodných alternatív na konkrétne, záväzné voľby pre implementáciu (zdôvodnenie jednotlivých volieb pre e-mail/notifikácie a platby je v sekcii 9.1):

| Vrstva | Technológia | Poznámka |
|---|---|---|
| Frontend | **React + TypeScript** | Komponentová štruktúra, vhodná pre AI-generovanie |
| Stavovosť/dáta/UI | **React Query** (server state) + **Zustand** (klientský stav) + **Tailwind CSS** | Rýchly vývoj, konzistentný dizajn |
| Backend | **Python 3.12 + FastAPI** | REST API, asynchrónne spracovanie, automatická OpenAPI dokumentácia, dobrá integrácia s AI nástrojmi |
| Databáza | **PostgreSQL** | Relačný model, silná konzistencia, podpora Row-Level Security |
| ORM | **SQLAlchemy 2.0** (s **Alembic** pre migrácie) | Typovaný deklaratívny model, dobrá čitateľnosť pre AI, štandard v Python ekosystéme |
| Validácia/schémy API | **Pydantic v2** | Natívna súčasť FastAPI, validácia vstupov/výstupov |
| Cache/queue | **Redis** | Session cache, rate limiting, broker pre asynchrónne úlohy |
| Asynchrónne úlohy | **Celery** (s Redis ako brokerom) | Odosielanie e-mailov/notifikácií, generovanie PDF, spracovanie webhookov na pozadí |
| Objektové úložisko | S3-kompatibilné úložisko | Súbory, dokumenty, transcripty |
| Autentifikácia | JWT (access + refresh token) + voliteľné OAuth2/SSO | Podpora 2FA pre administrátorské role |
| **E-mail/notifikácie** | **SendGrid** (transakčné e-maily) cez Celery úlohy | Spoľahlivé doručovanie, šablóny, sledovanie stavu doručenia; asynchrónne odosielanie neblokuje API |
| **Platby/fakturácia** | **Stripe** (Stripe Billing + Webhooks) cez oficiálne Python SDK | Štandard pre SaaS predplatné, podpora viacerých mien, automatizované faktúry, bezpečné spracovanie platieb mimo vlastnej infraštruktúry |
| Kontajnerizácia | Docker + Docker Compose | Samostatné kontajnery: frontend, backend, db, cache/worker |
| CI/CD | GitHub Actions | Lint, testy, build a nasadenie pri každom pull requeste |
| Monitoring | Sentry (chyby), Prometheus/Grafana (metriky) | Observabilita produkčnej prevádzky |
| Dokumentácia API | OpenAPI/Swagger UI (generované priamo z FastAPI) | Vždy aktuálna, bez manuálnej údržby |
| Testovanie | Vitest/React Testing Library (frontend), Pytest (backend) | Unit + integračné + záťažové testy kľúčových tokov |

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

## 17. ZÁVER

Navrhovaný systém **EduCore** je koncipovaný ako komerčná multi-tenant SaaS platforma pre správu akademickej agendy, ktorú si môže predplatiť viacero vzdelávacích inštitúcií súčasne. Oproti pôvodnému študijnému rozsahu je špecifikácia rozšírená o kľúčové prvky reálneho produktu – správu inštitúcií a predplatného, notifikácie, dokumenty, reporty, audit log a integrácie s tretími stranami – pri zachovaní jasne definovaného MVP, ktoré umožňuje overiť koncept skôr, než sa investuje do plného rozsahu funkcií.

Dôraz na modulárny vývoj s jasne definovaným API kontraktom, databázovou schémou a bezpečnou tenant izoláciou zároveň vytvára vhodné podmienky na efektívne využitie AI nástrojov počas celého vývojového cyklu – od generovania kódu, cez testy, až po dokumentáciu – pri zachovaní zodpovednosti tímu za výslednú kvalitu, bezpečnosť a súlad s reguláciami ako GDPR.
