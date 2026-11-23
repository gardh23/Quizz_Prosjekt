const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, fakeDb, once, startGame } = require('./helpers')

let server
afterEach(async () => { await server.close() })

const trueFalse = {
    id: 1, type: 'true_false', text: 'Jorda er rund', time_limit: 20, order_index: 0,
    answers: [
        { id: 11, question_id: 1, text: 'Sant', is_correct: true },
        { id: 12, question_id: 1, text: 'Usant', is_correct: false }
    ]
}

async function gradingFor(host, roomCode) {
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    return grading
}

test('true/false: players get both options without the key, and it is auto-graded', async () => {
    server = await startServer({ db: fakeDb([trueFalse]) })
    const { host, players: [ada, bob], roomCode, question } = await startGame(server)
    assert.deepEqual(question.answers, [{ id: 11, text: 'Sant' }, { id: 12, text: 'Usant' }])

    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
    bob.emit('player:answer', { roomCode, answerId: 12 })
    await once(bob, 'player:answer_result')

    const { playerAnswers } = await gradingFor(host, roomCode)
    const byName = Object.fromEntries(playerAnswers.map(a => [a.username, a]))
    assert.deepEqual([byName.ada.answerText, byName.ada.isCorrect, byName.ada.points], ['Sant', true, 1])
    assert.deepEqual([byName.bob.answerText, byName.bob.isCorrect, byName.bob.points], ['Usant', false, 0])
})

module.exports = { gradingFor }
