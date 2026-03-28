const pool = require('./db')

module.exports = function (io) {
    const sessions = {}

    io.on('connection', (socket) => {
        console.log('Bruker koblet til:', socket.id)

        socket.on('host:create', async ({ quizId }) => {
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
                username,
                score: 0,
                answers: {}
            }

            socket.join(roomCode)
            socket.emit('player:joined', { roomCode })
            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
            console.log(`${username} joined ${roomCode}`)
        })

        socket.on('host:start', async ({ roomCode }) => {
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
            session.status = 'active'
            session.currentQuestion = 0

            const question = session.questions[session.currentQuestion]
            io.to(roomCode).emit('session:question', { question, index: 0, total: session.questions.length })
        })

        socket.on('player:answer', ({ roomCode, answerId, timeUsed }) => {
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
            if (player.answers[question.id]) {
                socket.emit('error', { message: 'Du har allerede svart' })
                return
            }

            const answer = question.answers.find(a => a.id === answerId)
            const isCorrect = answer?.is_correct || false

            let points = 0
            if (isCorrect) {
                points = question.speed_bonus
                    ? Math.round(1000 * (1 - timeUsed / (question.time_limit * 1000)))
                    : 500
            }

            player.answers[question.id] = { answerId, isCorrect, points }
            player.score += points
            socket.emit('player:answer_result', { isCorrect, points })
            io.to(roomCode).emit('session:players', { players: Object.values(session.players) })
        })

        socket.on('host:next', ({ roomCode }) => {
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            const leaderboard = Object.values(session.players)
                .sort((a, b) => b.score - a.score)
                .map((p, i) => ({ username: p.username, score: p.score, rank: i + 1 }))

            io.to(roomCode).emit('session:leaderboard', { leaderboard })

            session.currentQuestion++

            if (session.currentQuestion >= session.questions.length) {
                session.status = 'finished'
                io.to(roomCode).emit('session:finished', { leaderboard })
                delete sessions[roomCode]
                return
            }

            const question = session.questions[session.currentQuestion]
            setTimeout(() => {
                io.to(roomCode).emit('session:question', { question, index: session.currentQuestion, total: session.questions.length })
            }, 5000)
        })

        socket.on('host:set_timer', ({ roomCode, seconds }) => {
            const session = sessions[roomCode]

            if (!session || session.host !== socket.id) {
                socket.emit('error', { message: 'Ikke tilgang' })
                return
            }

            io.to(roomCode).emit('session:timer_override', { seconds })
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