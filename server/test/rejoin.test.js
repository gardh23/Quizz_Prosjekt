const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { HOST, OTHER_HOST, startServer, once, never, createRoom, joinPlayers, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

async function dropHost(host, player) {
    const frozen = once(player, 'session:frozen')
    host.disconnect()
    await frozen
}

test('a player cannot take over a game when the host drops', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    await dropHost(host, ada)
    ada.emit('host:rejoin', { roomCode })
    const err = await once(ada, 'error')
    assert.match(err.message, /ikke tilgang/i)
})

test('another host account cannot take over the game', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    await dropHost(host, ada)
    const intruder = server.client(OTHER_HOST)
    intruder.emit('host:rejoin', { roomCode })
    const err = await once(intruder, 'error')
    assert.match(err.message, /ikke tilgang/i)
})

test('the same host account can rejoin a running question', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    await dropHost(host, ada)
    const back = server.client(HOST)
    const resumed = once(ada, 'session:resumed')
    back.emit('host:rejoin', { roomCode })
    const { question } = await resumed
    assert.equal(question.id, 1)
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
})

test('a host who drops in the lobby comes back to an open lobby', async () => {
    const { host, roomCode } = await createRoom(server)
    const [ada] = await joinPlayers(server, roomCode, ['ada'])
    await dropHost(host, ada)
    const back = server.client(HOST)
    back.emit('host:rejoin', { roomCode })
    await once(back, 'host:rejoined')
    await joinPlayers(server, roomCode, ['bob'])
})

test('a refreshing host can take over before the old connection is gone', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    const back = server.client(HOST)
    const resumed = once(ada, 'session:resumed')
    back.emit('host:rejoin', { roomCode })
    await once(back, 'host:rejoined')
    await resumed

    host.disconnect()
    assert.ok(await never(ada, 'session:frozen'))
    const next = once(ada, 'session:question')
    back.emit('host:next', { roomCode })
    assert.equal((await next).question.id, 2)
})

test('the question timer is paused while the game is frozen', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:set_timer', { roomCode, seconds: 1 })
    await once(ada, 'session:timer_override')
    await dropHost(host, ada)
    await new Promise(r => setTimeout(r, 1300))

    const back = server.client(HOST)
    const resumed = once(ada, 'session:resumed')
    back.emit('host:rejoin', { roomCode })
    const { timeRemaining } = await resumed
    assert.ok(timeRemaining >= 0 && timeRemaining <= 1, `timeRemaining ${timeRemaining}`)

    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
})

test('a host who drops during grading comes back to grading', async () => {
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    host.emit('host:next', { roomCode })
    await once(host, 'session:grading_question')

    await dropHost(host, ada)
    const back = server.client(HOST)
    const grading = once(back, 'session:grading_question')
    back.emit('host:rejoin', { roomCode })
    assert.equal((await grading).gradingIndex, 0)

    const next = once(back, 'session:grading_question')
    back.emit('host:grading_next', { roomCode })
    assert.equal((await next).gradingIndex, 1)
    assert.ok(await never(ada, 'session:question'))
})
