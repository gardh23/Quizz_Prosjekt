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

const ranking = {
    id: 3, type: 'ranking', text: 'Sorter fra minst til størst', time_limit: 20, order_index: 0,
    answers: [
        { id: 31, question_id: 3, text: 'Mus', is_correct: true },
        { id: 32, question_id: 3, text: 'Katt', is_correct: true },
        { id: 33, question_id: 3, text: 'Hest', is_correct: true },
        { id: 34, question_id: 3, text: 'Elefant', is_correct: true }
    ]
}

async function rankingGame(orders, { speedBonus = false } = {}) {
    server = await startServer({ db: fakeDb([ranking]) })
    const names = Object.keys(orders)
    const { host, players, roomCode } = await startGame(server, names, { speedBonus })
    for (const [i, name] of names.entries()) {
        players[i].emit('player:answer', { roomCode, ranking: orders[name] })
        await once(players[i], 'player:answer_result')
    }
    const { playerAnswers } = await gradingFor(host, roomCode)
    return Object.fromEntries(playerAnswers.map(a => [a.username, a]))
}

test('ranking: players get the options shuffled, the same way for everyone', async () => {
    server = await startServer({ db: fakeDb([ranking]) })
    const { roomCode, question, players: [ada, bob] } = await startGame(server, ['ada', 'bob'])
    const ids = question.answers.map(a => a.id)
    assert.notDeepEqual(ids, [31, 32, 33, 34])
    assert.deepEqual([...ids].sort(), [31, 32, 33, 34])
    assert.equal(question.answers.some(a => 'is_correct' in a), false)
    void ada

    bob.disconnect()
    await new Promise(r => setTimeout(r, 50))
    const again = server.client()
    again.emit('player:rejoin', { roomCode, username: 'bob' })
    const { question: rejoined } = await once(again, 'player:rejoined')
    assert.deepEqual(rejoined.answers.map(a => a.id), ids)
})

test('ranking without speed bonus: 1 point when at least half the positions are right', async () => {
    const byName = await rankingGame({
        ada: [31, 32, 33, 34],
        bob: [31, 32, 34, 33],
        cid: [32, 33, 34, 31]
    })
    assert.deepEqual([byName.ada.points, byName.ada.answerText], [1, 'Mus → Katt → Hest → Elefant'])
    assert.equal(byName.bob.points, 1)
    assert.equal(byName.cid.points, 0)
})

test('ranking with speed bonus: 0-1000 by share of correct positions', async () => {
    const byName = await rankingGame({ ada: [31, 32, 33, 34], bob: [31, 32, 34, 33] }, { speedBonus: true })
    assert.equal(byName.ada.points, 1000)
    assert.equal(byName.bob.points, 500)
})

test('ranking: an order that is not a permutation of the options is rejected', async () => {
    server = await startServer({ db: fakeDb([ranking]) })
    const { players: [ada], roomCode } = await startGame(server, ['ada'])
    for (const bad of [[31, 31, 33, 34], [31, 32, 33], [31, 32, 33, 99], 'abc']) {
        ada.emit('player:answer', { roomCode, ranking: bad })
        const err = await once(ada, 'error')
        assert.match(err.message, /ugyldig rekkefølge/i)
    }
})

module.exports = { gradingFor }
