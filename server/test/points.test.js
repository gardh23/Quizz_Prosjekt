const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

// ada answers the multiple-choice question correctly (auto 1 point); host enters grading on it.
async function gradingFirstQuestion() {
    const game = await startGame(server, ['ada'])
    const { host, players: [ada], roomCode } = game
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    const { playerAnswers } = await grading
    return { ...game, adaId: playerAnswers[0].socketId }
}

async function setPoints(host, roomCode, playerId, points) {
    const update = once(host, 'session:grading_question')
    host.emit('host:set_points', { roomCode, playerId, points })
    return (await update).playerAnswers[0]
}

async function finalScore(host, roomCode) {
    const finished = once(host, 'session:finished')
    host.emit('host:end', { roomCode })
    return (await finished).leaderboard[0].score
}

test('the host can give more than one point, replacing the automatic score', async () => {
    const { host, roomCode, adaId } = await gradingFirstQuestion()
    const row = await setPoints(host, roomCode, adaId, 3)
    assert.deepEqual([row.points, row.manual], [3, true])
    assert.equal(await finalScore(host, roomCode), 3)
})

test('the host can give negative points, and a new value replaces the old one', async () => {
    const { host, roomCode, adaId } = await gradingFirstQuestion()
    await setPoints(host, roomCode, adaId, 5)
    const row = await setPoints(host, roomCode, adaId, -2)
    assert.equal(row.points, -2)
    assert.equal(await finalScore(host, roomCode), -2)
})

test('points must be a whole number', async () => {
    const { host, roomCode, adaId } = await gradingFirstQuestion()
    for (const bad of [1.5, '3', null, Infinity]) {
        host.emit('host:set_points', { roomCode, playerId: adaId, points: bad })
        const err = await once(host, 'error')
        assert.match(err.message, /ugyldig poeng/i)
    }
})

test('points can only be set in the grading phase, and only by the host', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:set_points', { roomCode, playerId: ada.id, points: 2 })
    assert.match((await once(host, 'error')).message, /rettefasen/i)
    ada.emit('host:set_points', { roomCode, playerId: ada.id, points: 2 })
    assert.match((await once(ada, 'error')).message, /ikke tilgang/i)
})
