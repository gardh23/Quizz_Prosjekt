const http = require('http')
const { Server } = require('socket.io')
const { io: connect } = require('socket.io-client')
const attachGame = require('../socket')

const HOST = { id: 1, username: 'vert', role: 'host' }
const OTHER_HOST = { id: 2, username: 'annen', role: 'host' }

const questions = [
    {
        id: 1, type: 'multiple_choice', text: 'Hva er 2+2?', time_limit: 20, order_index: 0,
        answers: [
            { id: 11, question_id: 1, text: '4', is_correct: true },
            { id: 12, question_id: 1, text: '5', is_correct: false }
        ]
    },
    {
        id: 2, type: 'free_text', text: 'Hovedstaden i Norge?', time_limit: 20, order_index: 1,
        answers: [{ id: 21, question_id: 2, text: 'Oslo', is_correct: true }]
    }
]

function fakeDb() {
    return {
        query: async (sql) => {
            if (sql.includes('FROM quizzes')) return { rows: [{ id: 1 }] }
            if (sql.includes('FROM questions')) return { rows: structuredClone(questions) }
            throw new Error(`unexpected query: ${sql}`)
        }
    }
}

// The real server verifies a JWT; tests pass the decoded user directly.
async function startServer({ db = fakeDb() } = {}) {
    const httpServer = http.createServer()
    const io = new Server(httpServer)
    io.use((socket, next) => {
        socket.user = socket.handshake.auth.user || null
        next()
    })
    attachGame(io, db, { countdownSeconds: 0 })
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${httpServer.address().port}`
    const clients = []

    return {
        client(user = null) {
            const c = connect(url, { auth: { user }, transports: ['websocket'], forceNew: true })
            clients.push(c)
            return c
        },
        async close() {
            clients.forEach(c => c.disconnect())
            await new Promise(resolve => io.close(resolve))
        }
    }
}

function once(socket, event, ms = 2000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms)
        socket.once(event, data => {
            clearTimeout(timer)
            resolve(data)
        })
    })
}

// Resolves true if the event does NOT arrive within ms.
function never(socket, event, ms = 300) {
    return new Promise(resolve => {
        const handler = () => resolve(false)
        socket.once(event, handler)
        setTimeout(() => {
            socket.off(event, handler)
            resolve(true)
        }, ms)
    })
}

async function createRoom(server, user = HOST) {
    const host = server.client(user)
    host.emit('host:create', { quizId: 1 })
    const { roomCode } = await once(host, 'host:created')
    return { host, roomCode }
}

async function joinPlayers(server, roomCode, names) {
    const players = []
    for (const username of names) {
        const p = server.client()
        p.emit('player:join', { roomCode, username })
        await once(p, 'player:joined')
        players.push(p)
    }
    return players
}

async function startGame(server, names = ['ada', 'bob'], { speedBonus = false } = {}) {
    const { host, roomCode } = await createRoom(server)
    const players = await joinPlayers(server, roomCode, names)
    const firstQuestion = Promise.all([host, ...players].map(s => once(s, 'session:question')))
    host.emit('host:start', { roomCode, speedBonus })
    const [{ question: hostQuestion }, { question }] = await firstQuestion
    return { host, players, roomCode, question, hostQuestion }
}

module.exports = { HOST, OTHER_HOST, questions, fakeDb, startServer, once, never, createRoom, joinPlayers, startGame }
