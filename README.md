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
- **Leaderboard** vises mellom hvert spørsmål
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
