const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, fakeDb, once, startGame, createRoom, joinPlayers } = require('./helpers')

let server
afterEach(async () => { await server.close() })

async function toGrading(host, roomCode) {
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    return grading
}

test('grading a player who never answered does not crash the server', async () => {
    server = await startServer()
    const { host, roomCode } = await startGame(server, ['ada'])
    await toGrading(host, roomCode)
    const q2 = once(host, 'session:grading_question')
    host.emit('host:grading_next', { roomCode })
    const { playerAnswers } = await q2

    host.emit('host:grade', { roomCode, playerId: playerAnswers[0].socketId, isCorrect: true })
    await once(host, 'error')

    const finished = once(host, 'session:finished')
    host.emit('host:grading_next', { roomCode })
    await finished
})

test('events without a payload do not crash the server', async () => {
    server = await startServer()
    const { host, roomCode } = await createRoom(server)
    const p = server.client()
    for (const event of ['player:join', 'player:answer', 'player:rejoin', 'host:rejoin', 'host:start', 'host:next', 'host:grade']) {
        p.emit(event)
        host.emit(event)
    }
    await new Promise(r => setTimeout(r, 100))
    await joinPlayers(server, roomCode, ['ada'])
})

test('a database error on start is reported, not crashed on', async () => {
    const db = fakeDb()
    const realQuery = db.query
    db.query = async (sql, params) => {
        if (sql.includes('FROM questions')) throw new Error('db down')
        return realQuery(sql, params)
    }
    server = await startServer({ db })
    const { host, roomCode } = await createRoom(server)
    host.emit('host:start', { roomCode })
    const err = await once(host, 'error')
    assert.match(err.message, /noe gikk galt/i)
    await joinPlayers(server, roomCode, ['ada'])
})
