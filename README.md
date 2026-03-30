# Quizz Prosjekt

Kahoot-inspirert quiz-applikasjon med støtte for flervalg og fritekst-svar.

**Live:** https://gardh23.eu/quiz/

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
- Støtte for **flervalg og fritekst i samme quiz**
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
questions     — id, quiz_id (FK), type (multiple_choice/free_text), text,
                time_limit, order_index, image_path, audio_path, image_width (INTEGER DEFAULT 100)
answers       — id, question_id (FK), text, is_correct (DEFAULT true)
```

- `speed_bonus` ligger på quiz-nivå og settes i lobbyen
- `image_width` er INTEGER 10–100, styrer visningsbredde i prosent
- For fritekst lagres én answer-rad med fasit (is_correct = true)

---

## Socket.io-hendelser

### Host sender:
- `host:create` → oppretter spilløkt med romkode
- `host:start` → starter quiz med `speedBonus`-valg fra lobbyen
- `host:next` → starter nedtelling og sender neste spørsmål automatisk; etter siste spørsmål starter rettefasen
- `host:set_timer` → overstyrer timer live
- `host:grade` → vurderer fritekst-svar (isCorrect: true/false) — kun i rettefasen
- `host:grading_next` → går til neste spørsmål i rettefasen, eller avslutter med leaderboard
- `host:rejoin` → gjenkobler etter frakobling

### Spiller sender:
- `player:join` → blir med i rom; hvis samme brukernavn finnes og er frakoblet, behandles som rejoin
- `player:answer` → sender svar (answerId + timeUsed + freeTextResponse for fritekst); fritekst kan sendes inn på nytt for å oppdatere
- `player:rejoin` → gjenkobler etter frakobling (kun hvis spilleren er markert frakoblet)

### Server sender til rom:
- `host:created` → romkode klar
- `player:joined` → bekreftelse til spiller
- `player:rejoined` → bekreftelse på rejoin med `{ score, status, question, timeRemaining }`
- `session:players` → oppdatert spillerliste (inkl. answers for å vise hvem som har svart)
- `session:question` → nytt spørsmål
- `session:countdown` → nedtelling mellom spørsmål `{ seconds: 5 }`
- `player:answer_result` → bekreftelse på svar (til spiller); vises som flash-melding
- `host:free_text_answer` → fritekst-svar videresendt til host (oppdaterer eksisterende ved re-innsending)
- `session:grading_question` → starter/oppdaterer rettefasen med `{ question, playerAnswers, gradingIndex, total }` — sendes til hele rommet
- `session:answer_graded` → kringkastes til hele rommet når host retter et svar `{ username, isCorrect, points }`
- `session:finished` → quiz ferdig med endelig leaderboard (alle spillere + poeng)
- `session:frozen` → host koblet fra, quiz fryst
- `session:resumed` → host koblet til igjen

---

## Viktige implementasjonsdetaljer

- **Delt socket-instans**: `client/src/socket.js` eksporterer én instans — unngår doble tilkoblinger
- **useRef for username i Play.jsx**: Løser stale closure-problem i useEffect med tom dependency array
- **Romkode som ordpar**: Genereres som `ADJEKTIV-SUBSTANTIV` (f.eks. `GLAD-HEST`) fra to ordlister — 2750+ kombinasjoner. Spillere kan skrive med mellomrom eller bindestrek, normaliseres til uppercase med bindestrek
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
- **Disconnect-håndtering**: Host-frakobling fryser quizen, spillere markeres `connected: false`
- **JSON.parse av answers**: FormData sender alt som strings — `parsedAnswers` håndterer dette i PUT og POST
- **Socket.io autentisering**: JWT sendes via `socket.handshake.auth.token`, host-hendelser krever rolle `host`/`admin`
- **Rate limiting**: Login og register begrenset til 10 forsøk per 15 min per IP
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
- **Droplet**: Ubuntu, IP `104.248.81.228`, domene `gardh23.eu`
- **Bruker**: `gard` (sudo, ikke root)
- **Brannmur**: `ufw` — kun port 22, 80, 443 åpne
- **Node.js**: v22 (installert via NodeSource)
- **PostgreSQL**: Lokal installasjon, kun tilgjengelig internt
- **NGINX**: v1.24, håndterer HTTPS og reverse proxy
- **PM2**: Kjører Express som systemtjeneste, starter automatisk ved reboot
- **HTTPS**: Let's Encrypt via Certbot (allerede satt opp for gardh23.eu)

### Prosjektplassering
```
/home/gard/Quizz_Prosjekt/
├── client/dist/          # Bygget React-app (genereres med npm run build)
└── server/
    ├── .env              # Hemmeligheter (chmod 600, ikke i git)
    └── uploads/          # Opplastede filer
```

### NGINX-konfig (`/etc/nginx/sites-available/gardh23.eu`)
```nginx
location /quiz/ {
    alias /home/gard/Quizz_Prosjekt/client/dist/;
    try_files $uri $uri/ /quiz/index.html;
}
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
location ~ ^/(auth|quizzes|admin|uploads) {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
client_max_body_size 10M;
```

### Database
- **Navn**: `quizz_db`
- **Bruker**: `quizz_user` — kun rettigheter til `quizz_db` (ikke superuser)
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
- Minste privilegium: `quizz_user` har kun tilgang til `quizz_db`
- Ingen hemmeligheter i git — `.env` er i `.gitignore` og har `chmod 600`
- Express (port 3000) er ikke eksponert mot internett — kun NGINX snakker med den
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

## Neste steg

Prosjektet er ferdig og i produksjon på https://gardh23.eu/quiz/
