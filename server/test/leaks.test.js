const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

test('players do not receive which answer is correct', async () => {
    const { question } = await startGame(server)
    assert.deepEqual(question.answers, [{ id: 11, text: '4' }, { id: 12, text: '5' }])
})

test('players do not receive the free-text key', async () => {
    const { host, players: [ada], roomCode } = await startGame(server)
    const next = once(ada, 'session:question')
    host.emit('host:next', { roomCode })
    const { question } = await next
    assert.equal(question.type, 'free_text')
    assert.deepEqual(question.answers, [])
})

test('the host still receives the answer key', async () => {
    const { host, players: [ada], roomCode } = await startGame(server)
    const hostQ = once(host, 'session:question')
    const playerQ = once(ada, 'session:question')
    host.emit('host:next', { roomCode })
    const [{ question: forHost }] = await Promise.all([hostQ, playerQ])
    assert.equal(forHost.answers[0].text, 'Oslo')
    assert.equal(forHost.answers[0].is_correct, true)
})

test('the player list does not reveal answers, correctness or score', async () => {
    const { players: [ada, bob], roomCode } = await startGame(server)
    const update = once(bob, 'session:players')
    ada.emit('player:answer', { roomCode, answerId: 11 })
    const { players } = await update
    const adaPublic = players.find(p => p.username === 'ada')
    assert.deepEqual(adaPublic.answers, { 1: true })
    assert.equal(adaPublic.score, undefined)
})

test('the answer receipt does not say whether it was correct', async () => {
    const { players: [ada], roomCode } = await startGame(server)
    ada.emit('player:answer', { roomCode, answerId: 11 })
    const receipt = await once(ada, 'player:answer_result')
    assert.equal(receipt.isCorrect, undefined)
    assert.equal(receipt.points, undefined)
})

test('a rejoining player gets the question without the key', async () => {
    const { players: [ada], roomCode } = await startGame(server)
    ada.disconnect()
    await new Promise(r => setTimeout(r, 50))
    const again = server.client()
    again.emit('player:rejoin', { roomCode, username: 'ada' })
    const { question } = await once(again, 'player:rejoined')
    assert.equal(question.answers.some(a => 'is_correct' in a), false)
})
