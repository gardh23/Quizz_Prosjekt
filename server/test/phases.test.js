const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, fakeDb, once, never, startGame, createRoom, joinPlayers } = require('./helpers')

let server
afterEach(async () => { await server.close() })

async function gradeFreeText(host, roomCode) {
    host.emit('host:next', { roomCode })
    await once(host, 'session:grading_question')
    const q2 = once(host, 'session:grading_question')
    host.emit('host:grading_next', { roomCode })
    return (await q2).playerAnswers.find(a => a.username === 'ada').socketId
}

async function finalScore(host, roomCode, username) {
    const finished = once(host, 'session:finished')
    host.emit('host:grading_next', { roomCode })
    return (await finished).leaderboard.find(p => p.username === username).score
}

async function answerFreeText(server, names) {
    const game = await startGame(server, names)
    game.host.emit('host:next', { roomCode: game.roomCode })
    await once(game.players[0], 'session:question')
    game.players[0].emit('player:answer', { roomCode: game.roomCode, freeTextResponse: 'Oslo' })
    await once(game.players[0], 'player:answer_result')
    return game
}

test('pressing next twice during the countdown does not skip a question', async () => {
    server = await startServer({ countdownSeconds: 1 })
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:next', { roomCode })
    host.emit('host:next', { roomCode })
    const { question } = await once(ada, 'session:question', 3000)
    assert.equal(question.id, 2)
})

test('starting again mid-game does not reset the game', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
    host.emit('host:start', { roomCode })
    await once(host, 'error')
    ada.emit('player:answer', { roomCode, answerId: 11 })
    const err = await once(ada, 'error')
    assert.match(err.message, /allerede svart/i)
})

test('a quiz with no questions cannot be started', async () => {
    const db = fakeDb()
    const realQuery = db.query
    db.query = async (sql, params) => sql.includes('FROM questions') ? { rows: [] } : realQuery(sql, params)
    server = await startServer({ db })
    const { host, roomCode } = await createRoom(server)
    const [ada] = await joinPlayers(server, roomCode, ['ada'])
    host.emit('host:start', { roomCode })
    const err = await once(host, 'error')
    assert.match(err.message, /ingen spørsmål/i)
    assert.ok(await never(ada, 'session:question'))
    await joinPlayers(server, roomCode, ['bob'])
})

test('grading the same answer twice does not double the points', async () => {
    server = await startServer()
    const { host, roomCode } = await answerFreeText(server, ['ada'])
    const adaId = await gradeFreeText(host, roomCode)
    host.emit('host:grade', { roomCode, playerId: adaId, isCorrect: true })
    await once(host, 'session:answer_graded')
    host.emit('host:grade', { roomCode, playerId: adaId, isCorrect: true })
    await once(host, 'session:answer_graded')
    assert.equal(await finalScore(host, roomCode, 'ada'), 1)
})

test('changing a grade from right to wrong removes the points', async () => {
    server = await startServer()
    const { host, roomCode } = await answerFreeText(server, ['ada'])
    const adaId = await gradeFreeText(host, roomCode)
    host.emit('host:grade', { roomCode, playerId: adaId, isCorrect: true })
    await once(host, 'session:answer_graded')
    host.emit('host:grade', { roomCode, playerId: adaId, isCorrect: false })
    await once(host, 'session:answer_graded')
    assert.equal(await finalScore(host, roomCode, 'ada'), 0)
})

test('free-text answers can only be graded in the grading phase', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await answerFreeText(server, ['ada'])
    // A client's socket.id is the same id the server keys players by.
    host.emit('host:grade', { roomCode, playerId: ada.id, isCorrect: true })
    const err = await once(host, 'error')
    assert.match(err.message, /rettefasen/i)
})

test('grading_next does nothing outside the grading phase', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:grading_next', { roomCode })
    await once(host, 'error')
    assert.ok(await never(ada, 'session:grading_question'))
})
