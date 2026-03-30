# Quizz Prosjekt

Kahoot-inspirert quiz-applikasjon med støtte for flervalg og fritekst-svar.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS v4
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
- **Ikke rediger kode direkte** med mindre brukeren eksplisitt sier "du kan gjøre denne endringen for meg" eller "gjør det du" — vis hva som skal endres og la brukeren gjøre det selv
- **Hvis brukeren gir nye instrukser eller preferanser underveis, oppdater alltid denne README-filen slik at neste Claude-sesjon forstår dem**
- **I deploy-fasen gjør brukeren ALT selv** — Claude forklarer hva som skal gjøres og hvorfor, men skriver ingen kommandoer direkte inn i terminalen for brukeren. Forklar sikkerhetsbegrunnelsen bak hvert steg.

---

## Produktbeskrivelse

En quiz-app som ligner Kahoot, med følgende særtrekk:
- En **host** oppretter og styrer quizen live
- **5–15 spillere** deltar samtidig via sanntidskommunikasjon (Socket.io)
- Spørsmål lages **i forkant** og lagres i database
- Støtte for **flervalg og fritekst i samme quiz**
- Fritekst-svar vurderes **manuelt av host** live
- Host kan **overstyre tidtakeren live**
- **Hastighetsbonus** defineres per quiz i lobbyen (ikke per spørsmål)
- **Leaderboard** vises mellom hvert spørsmål
- **Innlogging påkrevd** for hosts og admin — spillere kan delta uten konto (bare brukernavn)
- **Admin** styrer hvem som er host eller spiller, kan slette brukere
- Hosts kan laste opp **bilde- og lydfiler** til spørsmål
- Alle hosts kan se og spille **alle lagrede quizer**
- Visuell stil inspirert av **Kahoot** — mørk bakgrunn, store fargerike elementer

---

## Filstruktur (nåværende)

```
Quizz/
├── client/              # React + Vite frontend
│   └── src/
│       ├── App.jsx               # Router + Home (videresender basert på rolle)
│       ├── api.js                # Axios-instans med base URL og JWT-interceptor
│       ├── socket.js             # Delt Socket.io-klientinstans
│       ├── components/
│       │   └── UserBadge.jsx     # Viser innlogget bruker + rolle + logg ut (fast øverst til høyre)
│       └── pages/
│           ├── Login.jsx         # Innloggingsside + "Bli med i quiz"-knapp
│           ├── Host.jsx          # Hostmeny: se/opprett/slett quizer, start quiz
│           ├── QuizEditor.jsx    # Legg til/rediger/slett spørsmål (flervalg + fritekst)
│           ├── HostLive.jsx      # Host sin live-visning: spillere, svar-status, fritekstvurdering
│           ├── Play.jsx          # Spillerside: bli med, svar på spørsmål, leaderboard
│           └── Admin.jsx         # Admin-panel: endre roller, slett brukere
├── server/
│   ├── index.js         # Express-server, Socket.io middleware (JWT), CORS, alle ruter
│   ├── db.js            # PostgreSQL Pool-tilkobling
│   ├── socket.js        # All Socket.io spilløkt-logikk
│   ├── routes/
│   │   ├── auth.js      # POST /auth/register og /auth/login (rate limited)
│   │   ├── quiz.js      # CRUD for quizer og spørsmål, inkl. filopplasting
│   │   └── admin.js     # GET/PUT/DELETE /admin/users (kun admin)
│   ├── middleware/
│   │   ├── auth.js      # requireAuth (JWT-verifisering) + requireRole(...roles)
│   │   └── upload.js    # multer-konfig: jpg/png/mp3, maks 10MB, validerer MIME + filendelse
│   └── uploads/         # Opplastede bilde- og lydfiler (ikke versjonskontrollert)
└── README.md
```

---

## Databaseskjema

```sql
users         — id, username, password_hash, role (admin/host/player)
quizzes       — id, title, created_by (FK users), created_at, speed_bonus (BOOLEAN)
questions     — id, quiz_id (FK), type (multiple_choice/free_text), text,
                time_limit, order_index, image_path, audio_path
answers       — id, question_id (FK), text, is_correct (DEFAULT true)
```

- `speed_bonus` ligger på quiz-nivå (ikke per spørsmål) og settes i lobbyen
- For fritekst lagres én answer-rad med fasit (is_correct = true)

---

## Socket.io-hendelser

### Host sender:
- `host:create` → oppretter spilløkt med romkode
- `host:start` → starter quiz med `speedBonus`-valg fra lobbyen
- `host:next` → viser leaderboard og sender neste spørsmål (eller avslutter)
- `host:set_timer` → overstyrer timer live
- `host:grade` → vurderer fritekst-svar (isCorrect: true/false)
- `host:rejoin` → gjenkobler etter frakobling

### Spiller sender:
- `player:join` → blir med i rom (ingen innlogging nødvendig)
- `player:answer` → sender svar (answerId + timeUsed + freeTextResponse for fritekst)
- `player:rejoin` → gjenkobler etter frakobling

### Server sender til rom:
- `host:created` → romkode klar
- `player:joined` → bekreftelse til spiller
- `session:players` → oppdatert spillerliste (inkl. answers for å vise hvem som har svart)
- `session:question` → nytt spørsmål
- `player:answer_result` → bekreftelse på svar (til spiller)
- `host:free_text_answer` → fritekst-svar videresendt til host
- `session:leaderboard` → leaderboard etter spørsmål
- `session:finished` → quiz ferdig, endelig leaderboard
- `session:frozen` → host koblet fra, quiz fryst
- `session:resumed` → host koblet til igjen

---

## Viktige implementasjonsdetaljer

- **Delt socket-instans**: `client/src/socket.js` eksporterer én instans — unngår doble tilkoblinger
- **useRef for username i Play.jsx**: Løser stale closure-problem i useEffect med tom dependency array
- **roomCode uppercase**: Spillere sender `roomCode.toUpperCase()` — sessions lagres med store bokstaver
- **freeTextResponse**: Spillers tekst sendes separat fra `answerId` (fasit-IDen)
- **Fritekst-poeng**: Settes til 0 ved innsending — host vurderer med `host:grade`
- **speed_bonus per quiz**: Defineres i lobbyen av host, sendes med `host:start`, lagres i `session.speedBonus`
- **Disconnect-håndtering**: Host-frakobling fryser quizen, spillere markeres `connected: false`
- **Reconnect**: Spillere matcher på username, host matcher på romkode
- **JSON.parse av answers**: FormData sender alt som strings — `parsedAnswers` håndterer dette i begge PUT og POST
- **Socket.io autentisering**: JWT sendes via `socket.handshake.auth.token`, host-hendelser krever rolle `host`/`admin`
- **Rate limiting**: Login og register begrenset til 10 forsøk per 15 min per IP
- **Input-validering socket**: `username` maks 30 tegn, `freeTextResponse` maks 100 tegn
- **Quiz-eierskap**: Host kan bare slette egne quizer — admin kan slette alle
- **Filopplasting**: Både MIME-type og filendelse valideres
- **Svar-status live**: Host ser hvem som har/ikke har svart under hvert spørsmål (grønn/grå)
- **Fasit for host**: Riktig(e) svar vises i grønt under spørsmålsteksten i HostLive
- **Timer**: `startTimer(seconds)` bruker `setInterval` + `useRef` i Play og HostLive — nullstilles ved nytt spørsmål, kan overstyres av host med `host:set_timer`
- **Custom audio-spiller**: Native `<audio>` uten `controls`, styrt via `useRef` — kun play/pause og volum eksponert for spiller
- **uploads/-mappen**: Opprettes automatisk ved serveroppstart via `fs.mkdirSync('uploads', { recursive: true })`
- **COALESCE ved spørsmålsoppdatering**: PUT-ruten bruker `COALESCE($5, image_path)` for å beholde eksisterende bilde/lyd hvis ingen ny fil lastes opp
- **image_width**: Lagres som INTEGER (10–100) i `questions`-tabellen, brukes som `style={{ width: imageWidth% }}` — begge Play og QuizEditor preview er begrenset til `max-w-2xl` for at % skal matche
- **Quiz-tittel redigering**: PUT `/quizzes/:id` med samme eierskapssjekk som DELETE
- **audio/mp3 MIME-type**: Hvitelistet i tillegg til `audio/mpeg` da noen nettlesere sender denne varianten

---

## Byggeplan

### FASE 1 — Database og brukermodell
**Status: Ferdig**

### FASE 2 — Quiz-modell og API
**Status: Ferdig**

### FASE 3 — Sanntidslogikk med Socket.io
**Status: Ferdig**

### FASE 4 — Frontend + forbedringer
**Status: Ferdig**

- [x] Alle sider stylet med Tailwind CSS v4 (Kahoot-inspirert)
- [x] UserBadge-komponent på alle innloggede sider
- [x] Admin-panel: endre roller, slett brukere (med bekreftelse)
- [x] Host kan slette quiz (med bekreftelse, kun egne)
- [x] QuizEditor: rediger eksisterende spørsmål
- [x] Host ser hvem som har svart live
- [x] Host ser fasit under spørsmålet
- [x] Hastighetsbonus-toggle i lobbyen (ikke ved quiz-opprettelse)
- [x] Sikkerhetsgjennomgang fullført
- [x] Timer — nedtelling per spørsmål, synlig for host og spiller, rød ved ≤ 10 sek, blokkerer svar ved 0
- [x] Bilde/lyd-grensesnitt i QuizEditor + visning i Play og HostLive
- [x] Custom audio-spiller for spillere (kun play/pause + volum)
- [x] Bildestørrelse per spørsmål — slider med live preview i QuizEditor, lagres som `image_width` i DB
- [x] Tilbake-knapp i QuizEditor og HostLive-lobby
- [x] Host kan endre navn på quiz direkte i QuizEditor

### FASE 5 — Deploy
**Status: Ikke påbegynt**

**Sikkerhetsprinsipper for deploy:**
- Minste privilegium: hver tjeneste/bruker skal bare ha tilgang til det den trenger
- Ingen hemmeligheter i kode eller git — alt i .env-filer som ikke versjonskontrolleres
- Angrepsflate: lukk alle porter som ikke er nødvendige
- HTTPS påkrevd — ingen produksjonsdata over HTTP
- Oppdaterte pakker og OS — kjente sårbarheter tettes

**Steg:**
- [ ] Sikre dropleten: oppdater OS, opprett ikke-root bruker, deaktiver root SSH-login, sett opp SSH-nøkkelautentisering, deaktiver passordinnlogging
- [ ] Sett opp brannmur (ufw): kun port 22 (SSH), 80 (HTTP) og 443 (HTTPS) åpne
- [ ] Installer Node.js, PostgreSQL og NGINX
- [ ] Opprett dedikert PostgreSQL-bruker med kun nødvendige rettigheter (ikke superuser)
- [ ] Sett opp .env for produksjon med sterke hemmeligheter (JWT_SECRET, DB-passord)
- [ ] Bygg React-appen (`npm run build`) og server den som statiske filer via NGINX
- [ ] Konfigurer NGINX som reverse proxy mot Express-serveren (kun intern tilgang til Express)
- [ ] Sett opp HTTPS med Let's Encrypt (certbot) — aldri server over ren HTTP i prod
- [ ] Kjør Express med PM2 (prosessmanager) — holder appen oppe og logger feil
- [ ] Sett opp logging (f.eks. winston) for produksjonsfeil

---

## Neste steg

**Start her:** Deploy til DigitalOcean (Fase 5).
