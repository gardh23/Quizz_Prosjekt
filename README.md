# Quizz Prosjekt

Kahoot-inspirert quiz-applikasjon med støtte for flervalg og fritekst-svar.

**Live:** https://gardh23.eu/quiz/

---


---

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express
- **Real-time**: Socket.io
- **Database**: PostgreSQL
- **Deploy**: NGINX + PM2 på DigitalOcean droplet (Ubuntu)
- **HTTPS**: Let's Encrypt via Certbot

---

## Produktbeskrivelse

En quiz-app som ligner Kahoot, med følgende særtrekk:
- En **host** oppretter og styrer quizen live
- **5–15 spillere** deltar samtidig via sanntidskommunikasjon (Socket.io)
- Spørsmål lages **i forkant** og lagres i database
- Fem spørsmålstyper som kan blandes i samme quiz: **flervalg, fritekst, sant/usant, tallestimat og rangering**
- Fritekst-svar vurderes **manuelt av host** live
- Host kan **overstyre tidtakeren live**
- **Hastighetsbonus** defineres per quiz i lobbyen (ikke per spørsmål)
- **Leaderboard** vises kun på slutten av quizen — nedtelling mellom spørsmål
- **Innlogging påkrevd** for hosts og admin — spillere kan delta uten konto (bare brukernavn)
- **Admin** styrer hvem som er host eller spiller, kan slette brukere
- Hosts kan laste opp **bilde- og lydfiler** til spørsmål
- Alle hosts kan se og spille **alle lagrede quizer**
- Visuell stil inspirert av **Kahoot** — mørk bakgrunn, store fargerike elementer

---

## Filstruktur

```
Quizz/
├── client/              # React + Vite frontend
│   ├── vite.config.js            # base: '/quiz/' for substi-deploy
│   └── src/
│       ├── App.jsx               # Router med basename="/quiz" + Home (videresender basert på rolle)
│       ├── api.js                # Axios-instans + mediaBase for miljøhåndtering
│       ├── socket.js             # Delt Socket.io-klientinstans med JWT
│       ├── components/
│       │   └── UserBadge.jsx     # Viser innlogget bruker + rolle + logg ut (fast øverst til høyre)
│       └── pages/
│           ├── Login.jsx         # Innloggingsside + "Bli med i quiz"-knapp
│           ├── Host.jsx          # Hostmeny: se/opprett/slett quizer, start quiz
│           ├── QuizEditor.jsx    # Legg til/rediger/slett spørsmål (flervalg + fritekst + bilde/lyd)
│           ├── HostLive.jsx      # Host sin live-visning: timer, spillere, svar-status, fritekstvurdering
│           ├── Play.jsx          # Spillerside: bli med, svar på spørsmål, custom audio-spiller
│           └── Admin.jsx         # Admin-panel: endre roller, slett brukere
├── server/
│   ├── index.js         # Express-server, auto-opprett uploads/, Socket.io JWT-middleware
│   ├── db.js            # PostgreSQL Pool-tilkobling via env-variabler
│   ├── socket.js        # All Socket.io spilløkt-logikk
│   ├── test/            # node:test-tester for spilllogikken (ekte Socket.io-server, falsk DB)
│   ├── routes/
│   │   ├── auth.js      # POST /auth/register og /auth/login (rate limited)
│   │   ├── quiz.js      # CRUD for quizer og spørsmål, inkl. filopplasting og image_width
│   │   └── admin.js     # GET/PUT/DELETE /admin/users (kun admin)
│   ├── middleware/
│   │   ├── auth.js      # requireAuth (JWT-verifisering) + requireRole(...roles)
│   │   └── upload.js    # multer-konfig: jpg/png/mp3+audio/mp3, maks 10MB, validerer MIME + filendelse
│   └── uploads/         # Opplastede bilde- og lydfiler (ikke versjonskontrollert, kun .gitkeep)
└── README.md
```

---

## Databaseskjema

```sql
users         — id, username, password_hash, role (admin/host/player)
quizzes       — id, title, created_by (FK users), created_at, speed_bonus (BOOLEAN)
questions     — id, quiz_id (FK), type (multiple_choice/free_text/true_false/number_estimate/ranking), text,
                time_limit, order_index, image_path, audio_path, image_width (INTEGER DEFAULT 100)
answers       — id, question_id (FK), text, is_correct (DEFAULT true)
```

- `speed_bonus` ligger på quiz-nivå og settes i lobbyen
- `image_width` er INTEGER 10–100, styrer visningsbredde i prosent
- For fritekst lagres én answer-rad med fasit (is_correct = true)
- Sant/usant lagres som to answer-rader, «Sant» og «Usant», der én er riktig — behandles som flervalg
- Tallestimat lagrer riktig tall som tekst i én answer-rad
- Rangering lagrer alternativene i riktig rekkefølge; rekkefølgen er `answers.id` (innsettingsrekkefølge), så alle spørringer sorterer på `id`
- **Poeng for tallestimat og rangering**: presisjon 0–1 (tallestimat: 1 ved eksakt, 0 ved 50 % feil; rangering: andel på riktig plass). Uten hastighetsbonus gir presisjon ≥ 0,5 ett poeng, ellers 0. Med hastighetsbonus gir de `1000 × presisjon`, uten tidsfaktor

---

## Socket.io-hendelser

### Host sender:
- `host:create` → oppretter spilløkt med romkode
- `host:start` → starter quiz med `speedBonus`-valg fra lobbyen (kun fra lobbyen, quizen må ha spørsmål)
- `host:next` → starter nedtelling og sender neste spørsmål automatisk; etter siste spørsmål starter rettefasen. Ignoreres under nedtelling
- `host:set_timer` → overstyrer timer live, og flytter serverens svarfrist (0–3600 sek)
- `host:grade` → vurderer fritekst-svar (isCorrect: true/false) — kun i rettefasen. Ny vurdering erstatter forrige
- `host:grading_next` → går til neste spørsmål i rettefasen (skjult igjen til `host:reveal`), eller avslutter med leaderboard
- `host:reveal` → viser fasit, riktig/feil og poeng for spillerne på gjeldende rettespørsmål
- `host:set_points` → `{ playerId, points }` setter en spillers poeng på gjeldende rettespørsmål til et heltall (også over 1 og negativt, alle typer). Erstatter forrige verdi
- `host:end` → avslutter: under spørsmålene hoppes resten over og rettefasen starter for de stilte spørsmålene; i rettefasen går den rett til pallen
- `host:rejoin` → gjenkobler etter frakobling — kun samme host-bruker, og quizen fortsetter i fasen den var i

### Spiller sender:
- `player:join` → blir med i rom; hvis samme brukernavn finnes og er frakoblet, behandles som rejoin
- `player:answer` → sender svar: `answerId` (flervalg, sant/usant), `freeTextResponse` (fritekst — kan sendes inn på nytt), `numberResponse` (tallestimat) eller `ranking` (array av answer-id-er i spillerens rekkefølge). Svartiden måles av serveren. Rangeringsalternativer stokkes én gang ved start (`playerOrder`) så alle ser samme rekkefølge
- `player:rejoin` → gjenkobler etter frakobling (kun hvis spilleren er markert frakoblet)

### Server sender til rom:
- `host:created` → romkode klar
- `player:joined` → bekreftelse til spiller
- `player:rejoined` → bekreftelse på rejoin med `{ score, status, question, index, total, timeRemaining }`
- `session:players` → oppdatert spillerliste `{ username, connected, answers: { [questionId]: true } }` — sier bare HVEM som har svart, ikke hva eller om det var riktig
- `session:question` → nytt spørsmål med `{ question, index, total }` (vises som «Spørsmål N av M»). Spillere får bare `{ id, text }` per alternativ (fritekst: ingen alternativer); host får hele spørsmålet med fasit
- `session:countdown` → nedtelling mellom spørsmål `{ seconds: 5 }`
- `player:answer_result` → tom kvittering på svar (til spiller); vises som flash-melding. Sier ikke om svaret var riktig
- `host:free_text_answer` → fritekst-svar videresendt til host (oppdaterer eksisterende ved re-innsending)
- `session:grading_question` → starter/oppdaterer rettefasen med `{ question, playerAnswers, distribution, revealed, gradingIndex, total }`. Sendes på nytt ved hver poengendring. Hosten får alt; spillerne får fasit, riktig/feil og poeng først når `revealed` er true
- `session:answer_graded` → kun til hosten når et fritekstsvar rettes `{ username, isCorrect, points }` (spillerne får det via rettevisningen etter avsløring)
- `session:finished` → quiz ferdig med endelig leaderboard (alle spillere + poeng)
- `session:frozen` → host koblet fra, quiz fryst
- `session:resumed` → host koblet til igjen

---

## Viktige implementasjonsdetaljer

- **Delt socket-instans**: `client/src/socket.js` eksporterer én instans — unngår doble tilkoblinger
- **useRef for username i Play.jsx**: Løser stale closure-problem i useEffect med tom dependency array
- **Romkode som ordpar**: Genereres som `ADJEKTIV-SUBSTANTIV` (f.eks. `GLAD-HEST`) fra to ordlister — 2750+ kombinasjoner. Trekkes på nytt til koden er ledig (maks 50 forsøk). Spillere kan skrive med mellomrom eller bindestrek, normaliseres til uppercase med bindestrek
- **Fasit holdes på serveren**: `questionForPlayers` fjerner `is_correct` og fritekst-fasit før spørsmål sendes til spillere; `publicPlayers` fjerner svar og poeng fra spillerlista. Fasit vises først i rettefasen
- **Serveren eier klokka**: `openQuestion` setter `questionStartedAt` og `questionDeadline`. Svar etter fristen (+1 sek slingringsmonn for nettverk) og under nedtelling avvises. Hastighetspoeng beregnes fra serverens tid og begrenses til 0–1000
- **Krasjsikre hendelser**: Alle socket-hendelser går via `on()`-innpakningen i `socket.js`, som tåler manglende payload og gjør feil om til en `error`-hendelse i stedet for å krasje prosessen (som ville slettet alle pågående spill)
- **Opprydding**: Hver hendelse oppdaterer rommets `lastActivity`; rom som har vært inaktive i 2 timer slettes
- **Svarfordeling**: `session:grading_question` har `distribution` (antall per alternativ + `isCorrect`) for flervalg og sant/usant, ellers `null`. Vises som stolper i svarknappenes farger (`components/AnswerDistribution.jsx`)
- **Leaderboard ved uavgjort**: lik poengsum gir delt plass, neste plass hoppes over (1, 1, 3)
- **Pall**: `components/Podium.jsx` avslører 3. → 2. → 1. plass, med konfetti (`canvas-confetti`) og fanfare. Respekterer `prefers-reduced-motion`
- **Designsystem**: knapperoller og feltstil defineres én gang i `src/index.css` (`.btn` + `.btn-go`/`.btn-next`/`.btn-soft`/`.btn-ghost`/`.btn-danger`/`.btn-danger-soft`/`.btn-lg`, `.field`). Bruk dem i stedet for egne fargeklasser. Inngangsanimasjoner (`animate-pop`, `animate-rise`) ligger i `@theme` og brukes alltid med `motion-safe:`
- **Delte komponenter**: `TopBar` (tilbake + brukermerke i flyt, ikke `fixed`), `Timer` (sekunder + tidslinje), `QuestionCounter` («Spørsmål N av M» over timeren), `AnswerLetter` (A–D på svarknapper og i svarfordelingen), `ResultBadge` (✓ kun når helt riktig, oransje delpoeng, rødt ✗), `YouBadge`, `FilePicker`
- **Invitasjon**: «Kopier invitasjon» i lobbyen lager en lenke `…/quiz/play?rom=KODE` som fyller ut romkoden
- **Lyd**: `src/sound.js` syntetiserer alt med Web Audio (ingen lydfiler). Toner hoppes over til nettleseren har låst opp lyd (første klikk). Mute-valget lagres i `localStorage` (`quizz_muted`)
- **freeTextResponse**: Spillers tekst sendes separat fra `answerId` (fasit-IDen); kan sendes inn på nytt så lenge timer ikke er ute
- **Fritekst-poeng**: Settes til 0 ved innsending — host vurderer med `host:grade` i rettefasen
- **Rettefase**: Etter siste spørsmål går quizen inn i `status: 'grading'`. Host blar gjennom alle spørsmål med `host:grading_next`. Flervalg rettes automatisk, fritekst manuelt. Alle spillere ser alle svar og rettingen live via `session:grading_question` og `session:answer_graded`. Leaderboard vises kun etter rettefasen.
- **buildPlayerAnswers**: Hjelpefunksjon på server — bygger array av `{ username, socketId, answered, answerText/freeTextResponse, isCorrect, points, graded }` for alle spillere per spørsmål
- **Fritekst-deduplicering**: `freeTextAnswers` i HostLive er objekt keyet på `username` — re-innsendinger og rejoin-scenarioer overskriver alltid korrekt
- **Nedtelling mellom spørsmål**: `session:countdown { seconds: 5 }` sendes fra server; neste spørsmål starter automatisk etter timeout — ingen "Neste spørsmål"-knapp under nedtelling
- **Leaderboard kun på slutten**: `session:leaderboard` er fjernet; endelig leaderboard viser alle spillere med poengsum, egen plass uthevet
- **Valgt svar-highlight**: Flervalg-knapper får `ring-4 ring-white` på valgt svar; `hover:scale-[1.03] hover:shadow-xl` på hover
- **Bekreftelses-flash**: `confirmFlash`-state i Play.jsx — grønn pulserende melding i 2 sek ved hver fritekst-innsending
- **Spiller rejoin ved refresh**: `sessionStorage` lagrer `{ roomCode, username }` ved join — ved refresh emitter Play.jsx automatisk `player:rejoin`. Server sender tilbake `{ status, question, timeRemaining }` beregnet fra `session.questionStartedAt`
- **Rejoin-sikkerhet**: `player:rejoin` krever `connected === false` — kan ikke ta over plass til tilkoblet spiller. `player:join` med eksisterende frakoblet brukernavn behandles som rejoin; tilkoblet brukernavn gir "Brukernavnet er allerede tatt"
- **questionStartedAt**: Settes på session ved spørsmålsstart, `null` under nedtelling — brukes til å beregne gjenstående tid ved rejoin
- **speed_bonus per quiz**: Defineres i lobbyen av host, sendes med `host:start`, lagres i `session.speedBonus`
- **Disconnect-håndtering**: Host-frakobling fryser quizen (fasen huskes i `statusBeforeFreeze`), spillere markeres `connected: false` og ser en pause-skjerm. HostLive sender `host:rejoin` ved oppstart og ved hver ny tilkobling, så en host som refresher eller mister nettet tar opp igjen spillet der det var. Svarfristen pauses mens spillet er fryst
- **JSON.parse av answers**: FormData sender alt som strings — `parsedAnswers` håndterer dette i PUT og POST
- **Socket.io autentisering**: JWT sendes via `socket.handshake.auth.token`, host-hendelser krever rolle `host`/`admin`
- **Rate limiting**: Login og register er rate-limited per IP
- **Input-validering socket**: `username` maks 30 tegn, `freeTextResponse` maks 100 tegn
- **Quiz-eierskap**: Host kan bare slette/redigere egne quizer — admin kan gjøre det for alle
- **Filopplasting**: Både MIME-type og filendelse valideres, `audio/mp3` hvitelistet i tillegg til `audio/mpeg`
- **uploads/-mappen**: Opprettes automatisk ved serveroppstart via `fs.mkdirSync('uploads', { recursive: true })`
- **COALESCE ved spørsmålsoppdatering**: PUT-ruten bruker `COALESCE($5, image_path)` for å beholde eksisterende bilde/lyd hvis ingen ny fil lastes opp
- **image_width**: Slider med live preview i QuizEditor, begge Play og preview begrenset til `max-w-2xl` for at % skal matche
- **Timer**: `startTimer(seconds)` bruker `setInterval` + `useRef` — nullstilles ved nytt spørsmål, rød ved ≤ 10 sek, blokkerer svar ved 0
- **Custom audio-spiller**: Native `<audio>` uten `controls`, styrt via `useRef` — kun play/pause og volum eksponert for spiller
- **mediaBase**: Eksportert fra `api.js` — `''` i produksjon, `'http://localhost:3000'` lokalt — brukes for alle bilde/lyd-URLer
- **Audio key i rettefase**: `<audio key={gradingQuestion.id}>` tvinger React til å opprette nytt element ved spørsmålsbytte, slik at nettleseren faktisk laster ny lydfil
- **Login redirect**: Bruker `navigate('/')` fra React Router (ikke `window.location.href`) for å respektere `basename="/quiz"`

---

## Produksjonsoppsett (DigitalOcean)

### Server
- **Droplet**: Ubuntu,domene `gardh23.eu`
- **Brannmur**: `ufw` — kun port 22, 80, 443 åpne
- **Node.js**: v22 (installert via NodeSource)
- **PostgreSQL**: Lokal installasjon, kun tilgjengelig internt
- **NGINX**: v1.24, håndterer HTTPS og reverse proxy
- **PM2**: Kjører Express som systemtjeneste, starter automatisk ved reboot
- **HTTPS**: Let's Encrypt via Certbot (allerede satt opp for gardh23.eu)

### Prosjektplassering
```
~/Quizz_Prosjekt/
├── client/dist/          # Bygget React-app (genereres med npm run build)
└── server/
    ├── .env              # Hemmeligheter (chmod 600, ikke i git)
    └── uploads/          # Opplastede filer
```

### NGINX-konfig (`/etc/nginx/sites-available/gardh23.eu`)
```nginx
location /quiz/ {
    alias ~/Quizz_Prosjekt/client/dist/;
    try_files $uri $uri/ /quiz/index.html;
}
location /socket.io/ {
    proxy_pass http://localhost:<port>;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
location ~ ^/(api-ruter) {
    proxy_pass http://localhost:<port>;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
client_max_body_size 10M;
```

### Database
- **Navn**: Konfigurert via `.env`
- **Bruker**: Dedikert DB-bruker — kun rettigheter til applikasjonens database (ikke superuser)
- Opprettet admin-bruker direkte i DB med bcrypt-hash

### Deploy-prosedyre ved oppdatering
```bash
# På Mac:
git push

# På serveren:
cd ~/Quizz_Prosjekt
git pull
cd client
npm run build
# (server trenger ikke restart med mindre server/-kode er endret)
# Hvis server/-kode er endret:
cd ~/Quizz_Prosjekt/server && pm2 restart quizz
```

### Sikkerhetsprinsipper
- Minste privilegium: dedikert DB-bruker har kun tilgang til applikasjonens database
- Ingen hemmeligheter i git — `.env` er i `.gitignore` og har `chmod 600`
- Express er ikke eksponert mot internett — kun NGINX snakker med den
- HTTPS tvunget — HTTP redirecter til HTTPS via Certbot
- Brannmur blokkerer alle porter unntatt 22, 80, 443

---

## Byggeplan

### FASE 1–4: Ferdig
### FASE 5 — Deploy: Ferdig

- [x] Sikret droplet med ikke-root bruker og SSH-nøkkel
- [x] Brannmur konfigurert (ufw)
- [x] Node.js 22, PostgreSQL, NGINX installert
- [x] Dedikert PostgreSQL-bruker med begrensede rettigheter
- [x] `.env` med sterke hemmeligheter, chmod 600
- [x] React bygget og servet via NGINX på `/quiz/`
- [x] NGINX reverse proxy mot Express
- [x] HTTPS med Let's Encrypt
- [x] PM2 med auto-start ved reboot
- [x] Quiz-kort lagt til på portfolio-forsiden (gardh23.eu)

---

## Tester

```bash
cd server
npm test
```

Testene i `server/test/` starter en ekte Socket.io-server med en falsk database og spiller gjennom spillet med ekte klienter. De dekker fasit-lekkasje, serverside tidtaking, host-rejoin, krasjsikring, fase-sperrer og romkoder. Ingen database trengs.

---

## Neste steg

Prosjektet er i produksjon på https://gardh23.eu/quiz/. Forbedringsrunde 2: fase 1 (sikkerhet og bugs), fase 2 (sant/usant, tallestimat, rangering) fase 3 (svarfordeling i rettefasen, pall med konfetti, lyd) og fase 4 (designoppussing) er gjort.
