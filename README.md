# Quizz Prosjekt

Kahoot-inspirert quiz-applikasjon med støtte for flervalg og fritekst-svar.

## Tech Stack
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Real-time**: Socket.io
- **Database**: PostgreSQL
- **Deploy**: NGINX på DigitalOcean droplet

---

## Til Claude: Kontekst og regler

- **Brukeren skriver mesteparten av koden selv** — din rolle er å forklare, veilede og vise retning, ikke å skrive alt ferdig
- **Aldri push til GitHub direkte** — brukeren gjør alle commits og pushes selv
- **Du kan oppdatere denne README-filen** for å holde oversikt over fremdrift og nye instrukser
- Brukeren lærer mens han bygger — **forklar alltid hva og hvorfor i detalj**, ikke bare hvordan. Ikke anta at brukeren vet hva noe er eller gjør — forklar konseptet, hvorfor vi gjør det, og hva som skjer under panseret. **Forklar underveis mens vi bygger, ikke alt på forhånd.**
- **Hvis brukeren gir nye instrukser eller preferanser underveis, oppdater alltid denne README-filen slik at neste Claude-sesjon forstår dem**

---

## Produktbeskrivelse

En quiz-app som ligner Kahoot, med følgende særtrekk:
- En **host** oppretter og styrer quizen live
- **5–15 spillere** deltar samtidig via sanntidskommunikasjon (Socket.io)
- Spørsmål lages **i forkant** og lagres i database
- Støtte for **flervalg og fritekst i samme quiz**
- Fritekst-svar vurderes **manuelt av host** (fuzzy match kan legges til senere)
- Host kan **overstyre tidtakeren live** (f.eks. endre fra 3 min til 20 sek midt i spørsmål)
- Hvert spørsmål har **toggle for hastighetsbonus** (raskere svar = flere poeng)
- **Leaderboard** vises mellom hvert spørsmål
- **Innlogging påkrevd** for alle brukere
- **Admin (eier)** styrer hvem som er host eller spiller
- Hosts kan laste opp **bilde- og lydfiler** til spørsmål — filtrering for sikkerhet er viktig
- Alle hosts kan se og spille **alle lagrede quizer**, uavhengig av hvem som lagde dem
- Quizer lagres og kan **spilles igjen**
- Visuell stil inspirert av **Kahoot** — mørk bakgrunn, store fargerike elementer

---

## Filstruktur (nåværende)

```
Quizz/
├── client/              # React + Vite frontend (boilerplate, ikke påbegynt)
│   └── src/
│       ├── App.jsx      # Standard Vite startside, skal bygges om
│       └── main.jsx
├── server/
│   ├── index.js         # Express-server, monterer alle ruter og static /uploads
│   ├── db.js            # PostgreSQL Pool-tilkobling (bruker: gard, db: quizz_db)
│   ├── routes/
│   │   ├── auth.js      # POST /auth/register og POST /auth/login med bcrypt + JWT
│   │   └── quiz.js      # CRUD for quizer og spørsmål, inkl. filopplasting
│   ├── middleware/
│   │   ├── auth.js      # requireAuth (JWT-verifisering) + requireRole(...roles)
│   │   └── upload.js    # multer-konfig: jpg/png/mp3, maks 10MB, lagres i uploads/
│   └── uploads/         # Opplastede bilde- og lydfiler (ikke versjonskontrollert)
└── README.md
```

---

## Byggeplan

Vi starter med **backend**, deretter frontend, så kobler vi alt sammen med Socket.io.

### FASE 1 — Database og brukermodell
**Status: Ferdig**

- [x] Sett opp PostgreSQL lokalt (installert via Homebrew, `brew install postgresql@16`)
- [x] Opprettet database: `createdb quizz_db`
- [x] Opprettet `users`-tabell med kolonnene: id, username, password_hash, role (admin/host/player)
- [x] Installert pakker: `npm install pg bcrypt jsonwebtoken` (kjørt `npm audit fix` etterpå)
- [x] Opprettet `server/db.js` — databasetilkobling via `pg` Pool
- [x] Koblet Express til databasen med `pg`-pakken
- [x] Implementert registrering (`POST /auth/register`) med bcrypt-hashing
- [x] Implementert innlogging (`POST /auth/login`) med bcrypt.compare + JWT-token i respons
- [x] Lag `middleware/auth.js` — verifiser JWT og beskytt ruter basert på rolle

#### Notater
- Node.js v25, npm v11, PostgreSQL v16
- PostgreSQL kjører som Homebrew-tjeneste (`brew services start postgresql@16`)
- Databasebruker: `gard`, ingen passord lokalt, port: 5432
- `users`-tabellen: id (SERIAL PK), username (VARCHAR 50, UNIQUE), password_hash (TEXT), role (VARCHAR 10, default: 'player')
- JWT_SECRET er hardkodet i `auth.js` som `'midlertidig_hemmelig_nokkel'` — skal flyttes til `.env` i produksjon
- Token utløper etter 7 dager (`expiresIn: '7d'`)

### FASE 2 — Quiz-modell og API
**Status: Ferdig**

- [x] Lag tabell: `quizzes` (id, title, created_by, created_at)
- [x] Lag tabell: `questions` (id, quiz_id, type, text, time_limit, speed_bonus, order_index, image_path, audio_path)
- [x] Lag tabell: `answers` (id, question_id, text, is_correct DEFAULT true) — brukes for både flervalg og fritekst. Fritekst har ett svar (fasit), is_correct er true som standard
- [x] REST-endepunkter for quiz CRUD (opprett, les, oppdater, slett)
- [x] Kun hosts og admin har tilgang til å opprette/endre quizer
- [x] REST-endepunkter for spørsmål (opprett, oppdater, slett)
- [x] Filhåndtering: opplasting av bilde/lyd per spørsmål med MIME-type validering og filstørrelsesbegrensning (multer, maks 10MB, jpg/png/mp3)

### FASE 3 — Sanntidslogikk med Socket.io
**Status: Ikke påbegynt**

- [ ] Spilløkt: host starter en quiz, spillere joiner via en romkode
- [ ] Host styrer flyten: neste spørsmål, avslutt tidtaker, overstyr timer
- [ ] Spillere sender inn svar i sanntid
- [ ] For fritekst: host ser alle svar og markerer rett/galt live
- [ ] Poengberegning (med og uten hastighetsbonus)
- [ ] Leaderboard sendes til alle etter hvert spørsmål

### FASE 4 — Frontend
**Status: Ikke påbegynt**

- [ ] Innloggingsside
- [ ] Spillermeny: bli med i quiz via kode
- [ ] Hostmeny: se alle quizer, opprett ny, start quiz
- [ ] Admin-panel: administrer brukere og roller
- [ ] Quiz-editor: legg til spørsmål, velg type, sett tidsbegrensning, toggle hastighetsbonus
- [ ] Live spillvisning: spørsmål, timer, svaralternativer / fritekstfelt
- [ ] Leaderboard-visning mellom spørsmål
- [ ] Kahoot-inspirert visuell stil

### FASE 5 — Deploy
**Status: Ikke påbegynt**

- [ ] Sett opp PostgreSQL på DigitalOcean dropleten (104.248.81.228)
- [ ] Bygg React-appen og server den via NGINX
- [ ] Konfigurer NGINX som reverse proxy mot Express-serveren
- [ ] Sett opp miljøvariabler (.env) for produksjon

---

## Neste steg

**Start her:** Fase 3 — installer `socket.io`, sett opp spilløkt med romkode, host-styring og sanntidskommunikasjon mellom spillere.
