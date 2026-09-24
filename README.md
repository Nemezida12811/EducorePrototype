# Akademický informačný systém

V tomto súbore uveďte popis systému, postup spustenia, postup testovania, očakávaný výsledok, testovacie prihlasovacie údaje. Tento text môžete následne zmazať.

Šablóna projektu obsahuje prázdne adresáre pre *frontend* a *backend* s prázdnymi súbormi `Dockerfile`. Ich obsah upravíte podľa zvolených technológií. Podľa potreby môžete vytvoriť ďalšie adresáre pre iné časti vášho systému.


## Minimálne požiadavky na spustenie projektu

1. Spustenie celého systému by malo byť možné pomocou `docker-compose`. Doplňte preto do súboru `docker-compose.yml` definície všetkých služieb, exportovaných portov a ďalšie údaje.
2. Príklad úplnej konfigurácie bez súkromných údajov by mal byť v `.env.example`. Pre spustenie by malo stačiť skopírovať tento súbor do `.env`.
3. Pri prvom spustení kontajnerov by sa mali automaticky vytvoriť databázové tabuľky a naplniť testovacími údajmi.
4. Aplikácia by mala poskytovať endpoint `/health/ready`, ktorý potvrdí jej pripravenosť vrátane pripojenia k databáze.
