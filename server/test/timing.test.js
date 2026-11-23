const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, never, startGame } = require('./helpers')

let server
afterEach(async () => { await server.close() })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function pointsInGrading(host, roomCode, username) {
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    const { playerAnswers } = await grading
    return playerAnswers.find(a => a.username === username)
}

test('speed bonus uses server time, not the time the client claims', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'], { speedBonus: true })
    await sleep(400)
    ada.emit('player:answer', { roomCode, answerId: 11, timeUsed: 0 })
    await once(ada, 'player:answer_result')
    const { points } = await pointsInGrading(host, roomCode, 'ada')
    assert.ok(points < 990, `expected < 990 after 400ms of 20s, got ${points}`)
    assert.ok(points > 900)
})

test('a negative timeUsed cannot give more than 1000 points', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'], { speedBonus: true })
    ada.emit('player:answer', { roomCode, answerId: 11, timeUsed: -100000 })
    await once(ada, 'player:answer_result')
    const { points } = await pointsInGrading(host, roomCode, 'ada')
    assert.ok(points <= 1000)
})

test('answers after the deadline are rejected', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:set_timer', { roomCode, seconds: 0 })
    await once(ada, 'session:timer_override')
    await sleep(20)
    ada.emit('player:answer', { roomCode, answerId: 11 })
    const err = await once(ada, 'error')
    assert.match(err.message, /tiden er ute/i)
})

test('host extending the timer moves the server deadline too', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:set_timer', { roomCode, seconds: 0 })
    await once(ada, 'session:timer_override')
    host.emit('host:set_timer', { roomCode, seconds: 30 })
    await once(ada, 'session:timer_override')
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
})

test('answers during the countdown are rejected', async () => {
    server = await startServer({ countdownSeconds: 1 })
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:next', { roomCode })
    await once(ada, 'session:countdown')
    ada.emit('player:answer', { roomCode, freeTextResponse: 'Oslo' })
    const err = await once(ada, 'error')
    assert.match(err.message, /ikke åpent/i)
})

test('an answer id that does not belong to the question is rejected', async () => {
    server = await startServer()
    const { players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('player:answer', { roomCode, answerId: 21 })
    const err = await once(ada, 'error')
    assert.match(err.message, /ugyldig svar/i)
    assert.ok(await never(ada, 'player:answer_result'))
})
