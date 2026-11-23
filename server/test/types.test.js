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

const estimate = {
    id: 2, type: 'number_estimate', text: 'Hvor høy er Mount Everest (m)?', time_limit: 20, order_index: 0,
    answers: [{ id: 21, question_id: 2, text: '8849', is_correct: true }]
}

async function estimateGame(guesses, { speedBonus = false } = {}) {
    server = await startServer({ db: fakeDb([estimate]) })
    const names = Object.keys(guesses)
    const { host, players, roomCode, question } = await startGame(server, names, { speedBonus })
    for (const [i, name] of names.entries()) {
        players[i].emit('player:answer', { roomCode, numberResponse: guesses[name] })
        await once(players[i], 'player:answer_result')
    }
    const { playerAnswers } = await gradingFor(host, roomCode)
    return { question, byName: Object.fromEntries(playerAnswers.map(a => [a.username, a])) }
}

test('estimate: players do not get the correct number', async () => {
    const { question } = await estimateGame({ ada: 8849 })
    assert.deepEqual(question.answers, [])
})

test('estimate without speed bonus: 1 point when at most 25% off, else 0', async () => {
    const { byName } = await estimateGame({ ada: 8849, bob: 7000, cid: 5000 })
    assert.deepEqual([byName.ada.points, byName.ada.isCorrect, byName.ada.answerText], [1, true, '8849'])
    assert.deepEqual([byName.bob.points, byName.bob.isCorrect], [1, true])
    assert.deepEqual([byName.cid.points, byName.cid.isCorrect], [0, false])
})

test('estimate with speed bonus: closeness points 0-1000, no time factor', async () => {
    const { byName } = await estimateGame({ ada: 8849, bob: 7964, cid: 4000 }, { speedBonus: true })
    assert.equal(byName.ada.points, 1000)
    assert.equal(byName.bob.points, 800)
    assert.equal(byName.cid.points, 0)
})

test('estimate: a non-number is rejected', async () => {
    server = await startServer({ db: fakeDb([estimate]) })
    const { players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('player:answer', { roomCode, numberResponse: 'mye' })
    const err = await once(ada, 'error')
    assert.match(err.message, /ugyldig tall/i)
})

module.exports = { gradingFor }
