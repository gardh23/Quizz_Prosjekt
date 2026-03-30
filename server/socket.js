const pool = require('./db')

module.exports = function (io) {
    const sessions = {}

    io.on('connection', (socket) => {
        console.log('Bruker koblet til:', socket.id)

        socket.on('host:create', async ({ quizId }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            try {
                const result = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId])
                if (result.rows.length === 0) {
                    socket.emit('error', { message: 'Quiz ikke funnet' })
                    return
                }

                const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

                sessions[roomCode] = {
                    quizId,
                    host: socket.id,
                    players: {},
                    status: 'waiting',
                    currentQuestion: 0
                }

                socket.join(roomCode)
                socket.emit('host:created', { roomCode })
                console.log(`Økt opprettet: ${roomCode}`)
            } catch (err) {
                console.error(err)
                socket.emit('error', { message: 'Noe gikk galt' })
            }
        })

        socket.on('player:join', ({ roomCode, username }) => {
            if (!username || typeof username !== 'string' || username.trim().length === 0 || username.length > 30) {
                socket.emit('error', { message: 'Ugyldig brukernavn (maks 30 tegn)' })
                return
            }

            const session = sessions[roomCode]

            if (!session) {
                socket.emit('error', { message: 'Romkode ikke funnet' })
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
            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
            console.log(`${username} joined ${roomCode}`)
        })

        socket.on('host:start', async ({ roomCode, speedBonus }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            const questionsResult = await pool.query(
                'SELECT questions.*, json_agg(answers.*) as answers FROM questions LEFT JOIN answers ON answers.question_id = questions.id WHERE questions.quiz_id = $1 GROUP BY questions.id ORDER BY questions.order_index',
                [session.quizId]
            )

            session.questions = questionsResult.rows
            session.speedBonus = speedBonus || false
            session.status = 'active'
            session.currentQuestion = 0

            const question = session.questions[session.currentQuestion]
            io.to(roomCode).emit('session:question', { question, index: 0, total: session.questions.length })
        })

        socket.on('player:answer', ({ roomCode, answerId, timeUsed, freeTextResponse }) => {
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

            const question = session.questions[session.currentQuestion]
            if (player.answers[question.id] && question.type !== 'free_text') {
                socket.emit('error', { message: 'Du har allerede svart' })
                return
            }

            const answer = question.answers.find(a => a.id === answerId)
            const isCorrect = question.type === 'free_text' ? false : (answer?.is_correct || false)

            let points = 0
            if (isCorrect) {
                points = session.speedBonus
                    ? Math.round(1000 * (1 - timeUsed / (question.time_limit * 1000)))
                    : 500
            }

            player.answers[question.id] = { answerId, isCorrect, points, timeUsed }
            player.score += points
            socket.emit('player:answer_result', { isCorrect, points })
            if (question.type === 'free_text') {
                const hostSocket = io.sockets.sockets.get(session.host)
                if (hostSocket) {
                    const safeResponse = typeof freeTextResponse === 'string'
                        ? freeTextResponse.slice(0, 100)
                        : ''
                    hostSocket.emit('host:free_text_answer', {
                        playerId: socket.id,
                        username: player.username,
                        answer: safeResponse,
                        questionId: question.id
                    })
                }
            }
            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
        })

        socket.on('host:next', ({ roomCode }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            session.currentQuestion++

            if (session.currentQuestion >= session.questions.length) {
                const leaderboard = Object.values(session.players)
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => ({ username: p.username, score: p.score, rank: i + 1 }))
                session.status = 'finished'
                io.to(roomCode).emit('session:finished', { leaderboard })
                delete sessions[roomCode]
                return
            }

            const countdownSeconds = 5
            io.to(roomCode).emit('session:countdown', { seconds: countdownSeconds })

            const question = session.questions[session.currentQuestion]
            setTimeout(() => {
                io.to(roomCode).emit('session:question', { question, index: session.currentQuestion, total: session.questions.length })
            }, countdownSeconds * 1000)
        })

        socket.on('host:set_timer', ({ roomCode, seconds }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            io.to(roomCode).emit('session:timer_override', { seconds })
        })

        socket.on('host:grade', ({ roomCode, playerId, isCorrect }) => {
            if (!socket.user || (socket.user.role !== 'host' && socket.user.role !== 'admin')) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            const player = session.players[playerId]
            if (!player) return

            const question = session.questions[session.currentQuestion]
            const points = isCorrect
                ? session.speedBonus
                    ? Math.round(1000 * (1 - player.answers[question.id].timeUsed / (question.time_limit * 1000)))
                    : 500
                : 0

            player.answers[question.id].isCorrect = isCorrect
            player.answers[question.id].points = points
            player.score += points

            const playerSocket = io.sockets.sockets.get(playerId)
            if (playerSocket) {
                playerSocket.emit('player:answer_result', { isCorrect, points })
            }

            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
        })


        socket.on('disconnect', () => {
            console.log('Bruker koblet fra:', socket.id)

            for (const roomCode in sessions) {
                const session = sessions[roomCode]

                if (session.host === socket.id) {
                    session.host = null
                    session.status = 'frozen'
                    io.to(roomCode).emit('session:frozen', { message: 'Host koblet fra — venter på at host kobler til igjen' })
                } else if (session.players[socket.id]) {
                    session.players[socket.id].connected = false
                    io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
                }
            }
        })

        socket.on('player:rejoin', ({ roomCode, username }) => {
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

            const oldId = Object.keys(session.players).find(id => session.players[id].username === username)
            session.players[socket.id] = { ...session.players[oldId], connected: true }
            delete session.players[oldId]

            socket.join(roomCode)
            socket.emit('player:rejoined', { score: session.players[socket.id].score })
            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
        })

        socket.on('host:rejoin', ({ roomCode }) => {
            const session = sessions[roomCode]

            if (!session) {
                socket.emit('error', { message: 'Romkode ikke funnet' })
                return
            }

            if (session.host !== null) {
                socket.emit('error', { message: 'En host er allerede tilkoblet' })
                return
            }

            session.host = socket.id
            session.status = 'active'

            socket.join(roomCode)

            const question = session.questions[session.currentQuestion]
            socket.emit('host:rejoined', { roomCode })
            io.to(roomCode).emit('session:resumed', { question, index: session.currentQuestion, total: session.questions.length })
        })


    })
}