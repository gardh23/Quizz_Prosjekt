const pool = require('./db')

const adjectives = [
    'YPPERLIG', 'FANTASTISK', 'MODIG', 'GLAD', 'STERK', 'RASK', 'LUR', 'SNILL',
    'FLINK', 'STOR', 'ROLIG', 'IVRIG', 'FRISK', 'TRYGG', 'SUNN', 'ÆRLIG', 'KLOK',
    'VARM', 'KALD', 'MYK', 'TUNG', 'FRI', 'NY', 'UNG', 'LANG', 'REN', 'LYS',
    'GRØNN', 'RØD', 'GUL', 'HVIT', 'RUND', 'SKARP', 'STILLE', 'VILL', 'SØT',
    'FIN', 'TØFF', 'KUL', 'SMART', 'KJEKK', 'BLANK', 'ELEGANT', 'HEFTIG',
    'SAFTIG', 'GYLLEN', 'LYSTIG', 'KRAFTIG', 'FREIDIG', 'SPORTY'
]

const nouns = [
    'DANS', 'SANG', 'FUGL', 'FISK', 'BJØRN', 'ULV', 'REV', 'ELG', 'HARE', 'SEL',
    'KU', 'HEST', 'GRIS', 'AND', 'MUS', 'HUND', 'KATT', 'ØRN', 'LAKS', 'ROSE',
    'SOL', 'MÅNE', 'SKY', 'VIND', 'IS', 'FJELL', 'DAL', 'SKOG', 'VANN', 'STEIN',
    'TRE', 'BLAD', 'BLOMST', 'FRUKT', 'BÆR', 'NØTT', 'BY', 'HUS', 'VEI', 'BRO',
    'BÅT', 'BOK', 'BORD', 'STOL', 'BALL', 'RING', 'BELTE', 'SKJOLD', 'SPYD', 'KOPP',
    'FENGSEL', 'NESEHÅR', 'BUDDASTAUE', 'SUSHIBIT', 'KAMERALINSE'
]

function buildPlayerAnswers(session, question) {
    return Object.entries(session.players).map(([socketId, player]) => {
        const ans = player.answers[question.id]
        if (!ans) return { username: player.username, socketId, answered: false }
        if (question.type === 'multiple_choice') {
            const answerObj = (question.answers || []).find(a => a.id === ans.answerId)
            return { username: player.username, socketId, answered: true, answerText: answerObj ? answerObj.text : '?', isCorrect: ans.isCorrect, points: ans.points }
        } else {
            return { username: player.username, socketId, answered: !!ans.freeTextResponse, freeTextResponse: ans.freeTextResponse || '', isCorrect: ans.isCorrect, points: ans.points, graded: !!ans.graded }
        }
    })
}

// Players must never see is_correct or the free-text key before the grading phase.
function questionForPlayers(question) {
    if (!question) return question
    const answers = question.type === 'free_text'
        ? []
        : (question.answers || []).filter(Boolean).map(({ id, text }) => ({ id, text }))
    return { ...question, answers }
}

// Broadcast to the whole room, so it only says WHO has answered — not what or whether it was right.
function publicPlayers(session) {
    return Object.values(session.players).map(p => ({
        username: p.username,
        connected: p.connected,
        answers: Object.fromEntries(Object.keys(p.answers).map(id => [id, true]))
    }))
}

function emitQuestion(io, roomCode, session, event, payload) {
    const forPlayers = { ...payload, question: questionForPlayers(payload.question) }
    if (session.host) {
        io.to(roomCode).except(session.host).emit(event, forPlayers)
        io.to(session.host).emit(event, payload)
    } else {
        io.to(roomCode).emit(event, forPlayers)
    }
}

// The server is the only clock that counts: a client can claim any timeUsed it likes.
function openQuestion(session) {
    const question = session.questions[session.currentQuestion]
    session.questionStartedAt = Date.now()
    session.questionDeadline = session.questionStartedAt + question.time_limit * 1000
}

function secondsRemaining(session) {
    return Math.max(0, Math.round((session.questionDeadline - Date.now()) / 1000))
}

function speedPoints(timeUsed, allowedMs) {
    if (allowedMs <= 0) return 0
    return Math.max(0, Math.min(1000, Math.round(1000 * (1 - timeUsed / allowedMs))))
}

function generateRoomCode(sessions) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
        const noun = nouns[Math.floor(Math.random() * nouns.length)]
        const code = `${adj}-${noun}`
        if (!sessions[code]) return code
    }
    return null
}

// answerGraceMs absorbs network latency for answers sent just as the timer hits 0.
// Sessions live only in memory; idleMs drops rooms nobody has touched (abandoned lobbies, vanished hosts).
module.exports = function (io, db = pool, {
    countdownSeconds = 5,
    answerGraceMs = 1000,
    idleMs = 2 * 60 * 60 * 1000,
    sweepMs = 10 * 60 * 1000
} = {}) {
    const sessions = {}

    setInterval(() => {
        const now = Date.now()
        for (const roomCode in sessions) {
            if (now - sessions[roomCode].lastActivity > idleMs) {
                console.log(`Økt ryddet bort (inaktiv): ${roomCode}`)
                delete sessions[roomCode]
            }
        }
    }, sweepMs).unref()

    io.on('connection', (socket) => {
        console.log('Bruker koblet til:', socket.id)

        // A thrown error in a handler is uncaught and kills the process, and with it
        // every game in `sessions`. Payloads come from clients, so they may be missing.
        const on = (event, handler) => socket.on(event, async (payload) => {
            try {
                const data = payload && typeof payload === 'object' ? payload : {}
                if (typeof data.roomCode === 'string' && sessions[data.roomCode]) {
                    sessions[data.roomCode].lastActivity = Date.now()
                }
                await handler(data)
            } catch (err) {
                console.error(`Feil i ${event}:`, err)
                socket.emit('error', { message: 'Noe gikk galt' })
            }
        })

        on('host:create', async ({ quizId }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            try {
                const result = await db.query('SELECT * FROM quizzes WHERE id = $1', [quizId])
                if (result.rows.length === 0) {
                    socket.emit('error', { message: 'Quiz ikke funnet' })
                    return
                }

                const roomCode = generateRoomCode(sessions)
                if (!roomCode) {
                    socket.emit('error', { message: 'Fant ingen ledig romkode, prøv igjen' })
                    return
                }

                sessions[roomCode] = {
                    quizId,
                    host: socket.id,
                    hostUserId: socket.user.id,
                    players: {},
                    status: 'waiting',
                    currentQuestion: 0,
                    lastActivity: Date.now()
                }

                socket.join(roomCode)
                socket.emit('host:created', { roomCode })
                console.log(`Økt opprettet: ${roomCode}`)
            } catch (err) {
                console.error(err)
                socket.emit('error', { message: 'Noe gikk galt' })
            }
        })

        on('player:join', ({ roomCode, username }) => {
            if (!username || typeof username !== 'string' || username.trim().length === 0 || username.length > 30) {
                socket.emit('error', { message: 'Ugyldig brukernavn (maks 30 tegn)' })
                return
            }

            const session = sessions[roomCode]

            if (!session) {
                socket.emit('error', { message: 'Romkode ikke funnet' })
                return
            }

            // Hvis brukernavnet allerede finnes og spilleren er frakoblet, behandle som rejoin
            const existingId = Object.keys(session.players).find(
                id => session.players[id].username === username.trim()
            )
            if (existingId && session.players[existingId].connected === false) {
                const playerData = { ...session.players[existingId], connected: true }
                delete session.players[existingId]
                session.players[socket.id] = playerData
                socket.join(roomCode)
                const currentQuestion = session.questionStartedAt
                    ? session.questions[session.currentQuestion]
                    : null
                const timeRemaining = currentQuestion ? secondsRemaining(session) : null
                socket.emit('player:rejoined', { score: playerData.score, status: session.status, question: questionForPlayers(currentQuestion), timeRemaining })
                io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
                return
            }

            if (existingId) {
                socket.emit('error', { message: 'Brukernavnet er allerede tatt' })
                return
            }

            if (session.status !== 'waiting') {
                socket.emit('error', { message: 'Quizen er allerede i gang' })
                return
            }

            session.players[socket.id] = {
                username: username.trim(),
                score: 0,
                answers: {}
            }

            socket.join(roomCode)
            socket.emit('player:joined', { roomCode })
            io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
            console.log(`${username} joined ${roomCode}`)
        })

        on('host:start', async ({ roomCode, speedBonus }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            if (session.status !== 'waiting') {
                socket.emit('error', { message: 'Quizen er allerede startet' })
                return
            }

            // Set before the await so a double click cannot start the game twice.
            session.status = 'starting'
            let questionsResult
            try {
                questionsResult = await db.query(
                    'SELECT questions.*, json_agg(answers.*) as answers FROM questions LEFT JOIN answers ON answers.question_id = questions.id WHERE questions.quiz_id = $1 GROUP BY questions.id ORDER BY questions.order_index',
                    [session.quizId]
                )
            } catch (err) {
                session.status = 'waiting'
                throw err
            }

            if (questionsResult.rows.length === 0) {
                session.status = 'waiting'
                socket.emit('error', { message: 'Quizen har ingen spørsmål' })
                return
            }

            session.questions = questionsResult.rows
            session.speedBonus = speedBonus || false
            session.status = 'active'
            session.currentQuestion = 0
            openQuestion(session)

            const question = session.questions[session.currentQuestion]
            emitQuestion(io, roomCode, session, 'session:question', { question, index: 0, total: session.questions.length })
        })

        on('player:answer', ({ roomCode, answerId, freeTextResponse }) => {
            const session = sessions[roomCode]

            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Ingen aktiv quiz' })
                return
            }

            const player = session.players[socket.id]
            if (!player) {
                socket.emit('error', { message: 'Du er ikke med i denne quizen' })
                return
            }

            if (!session.questionStartedAt) {
                socket.emit('error', { message: 'Spørsmålet er ikke åpent ennå' })
                return
            }

            const now = Date.now()
            if (now > session.questionDeadline + answerGraceMs) {
                socket.emit('error', { message: 'Tiden er ute' })
                return
            }

            const question = session.questions[session.currentQuestion]
            if (player.answers[question.id] && question.type !== 'free_text') {
                socket.emit('error', { message: 'Du har allerede svart' })
                return
            }

            const answer = (question.answers || []).find(a => a && a.id === answerId)
            if (question.type !== 'free_text' && !answer) {
                socket.emit('error', { message: 'Ugyldig svar' })
                return
            }

            const isCorrect = question.type === 'free_text' ? false : (answer?.is_correct || false)
            const safeResponse = question.type === 'free_text' && typeof freeTextResponse === 'string'
                ? freeTextResponse.slice(0, 100)
                : ''

            const timeUsed = now - session.questionStartedAt
            const allowedMs = session.questionDeadline - session.questionStartedAt
            let points = 0
            if (isCorrect) {
                points = session.speedBonus ? speedPoints(timeUsed, allowedMs) : 1
            }

            player.answers[question.id] = { answerId, isCorrect, points, timeUsed, allowedMs, freeTextResponse: safeResponse, graded: false }
            player.score += points
            socket.emit('player:answer_result', {})
            if (question.type === 'free_text') {
                const hostSocket = io.sockets.sockets.get(session.host)
                if (hostSocket) {
                    hostSocket.emit('host:free_text_answer', {
                        playerId: socket.id,
                        username: player.username,
                        answer: safeResponse,
                        questionId: question.id
                    })
                }
            }
            io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
        })

        on('host:next', ({ roomCode }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            // questionStartedAt is null during the countdown, so a second click there is ignored.
            if (session.status !== 'active' || !session.questionStartedAt) {
                socket.emit('error', { message: 'Kan ikke gå videre nå' })
                return
            }

            session.currentQuestion++

            if (session.currentQuestion >= session.questions.length) {
                session.status = 'grading'
                session.gradingIndex = 0
                const firstQuestion = session.questions[0]
                io.to(roomCode).emit('session:grading_question', {
                    question: firstQuestion,
                    playerAnswers: buildPlayerAnswers(session, firstQuestion),
                    gradingIndex: 0,
                    total: session.questions.length
                })
                return
            }

            session.questionStartedAt = null
            io.to(roomCode).emit('session:countdown', { seconds: countdownSeconds })

            const question = session.questions[session.currentQuestion]
            setTimeout(() => {
                if (sessions[roomCode] !== session) return
                openQuestion(session)
                emitQuestion(io, roomCode, session, 'session:question', { question, index: session.currentQuestion, total: session.questions.length })
            }, countdownSeconds * 1000)
        })

        on('host:grading_next', ({ roomCode }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]
            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            if (session.status !== 'grading') {
                socket.emit('error', { message: 'Ikke i rettefasen' })
                return
            }

            session.gradingIndex++

            if (session.gradingIndex >= session.questions.length) {
                const leaderboard = Object.values(session.players)
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => ({ username: p.username, score: p.score, rank: i + 1 }))
                session.status = 'finished'
                io.to(roomCode).emit('session:finished', { leaderboard })
                delete sessions[roomCode]
                return
            }

            const question = session.questions[session.gradingIndex]
            io.to(roomCode).emit('session:grading_question', {
                question,
                playerAnswers: buildPlayerAnswers(session, question),
                gradingIndex: session.gradingIndex,
                total: session.questions.length
            })
        })

        on('host:set_timer', ({ roomCode, seconds }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600) {
                socket.emit('error', { message: 'Ugyldig antall sekunder' })
                return
            }
            if (session.questionStartedAt) {
                session.questionDeadline = Date.now() + seconds * 1000
            }

            io.to(roomCode).emit('session:timer_override', { seconds })
        })

        on('host:grade', ({ roomCode, playerId, isCorrect }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            if (session.status !== 'grading') {
                socket.emit('error', { message: 'Svar kan bare rettes i rettefasen' })
                return
            }
            if (typeof isCorrect !== 'boolean') {
                socket.emit('error', { message: 'Ugyldig vurdering' })
                return
            }

            const player = session.players[playerId]
            if (!player) return

            const question = session.questions[session.gradingIndex]
            const ans = player.answers[question.id]
            if (!ans) {
                socket.emit('error', { message: 'Spilleren har ikke svart på dette spørsmålet' })
                return
            }
            if (question.type !== 'free_text') {
                socket.emit('error', { message: 'Bare fritekst-svar rettes manuelt' })
                return
            }

            const points = isCorrect
                ? session.speedBonus ? speedPoints(ans.timeUsed, ans.allowedMs) : 1
                : 0

            // Re-grading replaces the earlier grade instead of adding to it.
            player.score += points - (ans.graded ? ans.points : 0)
            ans.isCorrect = isCorrect
            ans.graded = true
            ans.points = points

            io.to(roomCode).emit('session:answer_graded', { username: player.username, isCorrect, points })
            io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
        })


        on('disconnect', () => {
            console.log('Bruker koblet fra:', socket.id)

            for (const roomCode in sessions) {
                const session = sessions[roomCode]

                if (session.host === socket.id) {
                    session.host = null
                    session.statusBeforeFreeze = session.status
                    session.status = 'frozen'
                    io.to(roomCode).emit('session:frozen', { message: 'Host koblet fra — venter på at host kobler til igjen' })
                } else if (session.players[socket.id]) {
                    session.players[socket.id].connected = false
                    io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
                }
            }
        })

        on('player:rejoin', ({ roomCode, username }) => {
            const session = sessions[roomCode]

            if (!session) {
                socket.emit('error', { message: 'Romkode ikke funnet' })
                return
            }

            const existing = Object.values(session.players).find(p => p.username === username)
            if (!existing) {
                socket.emit('error', { message: 'Fant ikke spilleren' })
                return
            }
            if (existing.connected !== false) {
                socket.emit('error', { message: 'Spilleren er allerede tilkoblet' })
                return
            }

            const oldId = Object.keys(session.players).find(id => session.players[id].username === username)
            const playerData = { ...session.players[oldId], connected: true }
            delete session.players[oldId]
            session.players[socket.id] = playerData

            socket.join(roomCode)

            const currentQuestion = session.questionStartedAt
                ? session.questions[session.currentQuestion]
                : null
            const timeRemaining = currentQuestion ? secondsRemaining(session) : null

            socket.emit('player:rejoined', {
                score: session.players[socket.id].score,
                status: session.status,
                question: questionForPlayers(currentQuestion),
                timeRemaining
            })
            io.to(roomCode).emit('session:players', { players: publicPlayers(session) })
        })

        on('host:rejoin', ({ roomCode }) => {
            const session = sessions[roomCode]

            if (!session) {
                socket.emit('error', { message: 'Romkode ikke funnet' })
                return
            }

            if (!socket.user || socket.user.id !== session.hostUserId) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            if (session.host !== null) {
                socket.emit('error', { message: 'En host er allerede tilkoblet' })
                return
            }

            session.host = socket.id
            session.status = session.statusBeforeFreeze

            socket.join(roomCode)
            socket.emit('host:rejoined', { roomCode, status: session.status })
            socket.emit('session:players', { players: publicPlayers(session) })

            if (session.status === 'grading') {
                const question = session.questions[session.gradingIndex]
                io.to(roomCode).emit('session:grading_question', {
                    question,
                    playerAnswers: buildPlayerAnswers(session, question),
                    gradingIndex: session.gradingIndex,
                    total: session.questions.length
                })
                return
            }

            const question = session.status === 'active' && session.questionStartedAt
                ? session.questions[session.currentQuestion]
                : null
            emitQuestion(io, roomCode, session, 'session:resumed', { question, index: session.currentQuestion, total: session.questions?.length ?? 0 })
        })


    })
}