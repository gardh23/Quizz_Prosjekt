const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

test('a full game runs from start to leaderboard', async () => {
    const { host, players: [ada, bob], roomCode } = await startGame(server)

    ada.emit('player:answer', { roomCode, answerId: 11, timeUsed: 1000 })
    await once(ada, 'player:answer_result')
    bob.emit('player:answer', { roomCode, answerId: 12, timeUsed: 1000 })
    await once(bob, 'player:answer_result')

    const q2 = once(ada, 'session:question')
    host.emit('host:next', { roomCode })
    assert.equal((await q2).question.type, 'free_text')

    ada.emit('player:answer', { roomCode, freeTextResponse: 'Oslo', timeUsed: 1000 })
    await once(ada, 'player:answer_result')

    const grading1 = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    assert.equal((await grading1).gradingIndex, 0)

    const grading2 = once(host, 'session:grading_question')
    host.emit('host:grading_next', { roomCode })
    const { playerAnswers } = await grading2
    const adaAnswer = playerAnswers.find(a => a.username === 'ada')

    const graded = once(host, 'session:answer_graded')
    host.emit('host:grade', { roomCode, playerId: adaAnswer.socketId, isCorrect: true })
    await graded

    const finished = once(ada, 'session:finished')
    host.emit('host:grading_next', { roomCode })
    const { leaderboard } = await finished
    assert.deepEqual(
        leaderboard.map(p => [p.username, p.score]),
        [['ada', 2], ['bob', 0]]
    )
})
