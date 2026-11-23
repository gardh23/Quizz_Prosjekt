const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, never, startGame } = require('./helpers')

let server
afterEach(async () => { await server.close() })

test('ending mid-question goes to grading with only the questions asked', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')

    const grading = once(host, 'session:grading_question')
    host.emit('host:end', { roomCode })
    const { gradingIndex, total } = await grading
    assert.deepEqual([gradingIndex, total], [0, 1])

    const finished = once(ada, 'session:finished')
    host.emit('host:grading_next', { roomCode })
    const { leaderboard } = await finished
    assert.deepEqual(leaderboard.map(p => [p.username, p.score]), [['ada', 1]])
})

test('ending during the countdown does not open the next question afterwards', async () => {
    server = await startServer({ countdownSeconds: 1 })
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:next', { roomCode })
    await once(ada, 'session:countdown')

    const grading = once(host, 'session:grading_question')
    host.emit('host:end', { roomCode })
    assert.equal((await grading).total, 1)
    assert.ok(await never(ada, 'session:question', 1500))
})

test('ending during grading goes straight to the leaderboard', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    host.emit('host:next', { roomCode })
    await once(host, 'session:grading_question')

    const finished = once(ada, 'session:finished')
    host.emit('host:end', { roomCode })
    await finished
})

test('a player cannot end the quiz', async () => {
    server = await startServer()
    const { players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('host:end', { roomCode })
    const err = await once(ada, 'error')
    assert.match(err.message, /ikke tilgang/i)
})
