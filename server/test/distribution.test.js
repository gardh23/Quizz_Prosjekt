const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

test('grading a choice question includes how many picked each option', async () => {
    const { host, players: [ada, bob, cid], roomCode } = await startGame(server, ['ada', 'bob', 'cid'])
    for (const [p, answerId] of [[ada, 11], [bob, 11], [cid, 12]]) {
        p.emit('player:answer', { roomCode, answerId })
        await once(p, 'player:answer_result')
    }
    host.emit('host:next', { roomCode })
    await once(host, 'session:question')
    // The host view; players only get isCorrect after reveal (see reveal.test.js).
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    const { distribution } = await grading
    assert.deepEqual(distribution, [
        { id: 11, text: '4', count: 2, isCorrect: true },
        { id: 12, text: '5', count: 1, isCorrect: false }
    ])

    const freeText = once(host, 'session:grading_question')
    host.emit('host:grading_next', { roomCode })
    assert.equal((await freeText).distribution, null)
})
