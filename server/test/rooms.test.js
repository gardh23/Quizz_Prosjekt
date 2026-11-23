const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { HOST, startServer, once, createRoom, joinPlayers } = require('./helpers')

let server
const realRandom = Math.random
afterEach(async () => {
    Math.random = realRandom
    await server.close()
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

test('a new room never overwrites a room that is in use', async () => {
    server = await startServer()
    Math.random = () => 0
    const { roomCode } = await createRoom(server)

    const second = server.client(HOST)
    second.emit('host:create', { quizId: 1 })
    const err = await once(second, 'error')
    assert.match(err.message, /romkode/i)

    await joinPlayers(server, roomCode, ['ada'])
})

test('an idle room is cleaned up', async () => {
    server = await startServer({ idleMs: 50, sweepMs: 20 })
    const { roomCode } = await createRoom(server)
    await sleep(150)
    const p = server.client()
    p.emit('player:join', { roomCode, username: 'ada' })
    const err = await once(p, 'error')
    assert.match(err.message, /ikke funnet/i)
})

test('a room with activity is kept', async () => {
    server = await startServer({ idleMs: 150, sweepMs: 20 })
    const { roomCode } = await createRoom(server)
    for (const name of ['ada', 'bob', 'cid', 'dag']) {
        await sleep(80)
        await joinPlayers(server, roomCode, [name])
    }
})
