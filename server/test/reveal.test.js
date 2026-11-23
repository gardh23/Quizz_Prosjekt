const { test, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, once, never, startGame } = require('./helpers')

let server
beforeEach(async () => { server = await startServer() })
afterEach(async () => { await server.close() })

// Two players answer the multiple-choice question (ada right, bob wrong) and the
// free-text one, then the host enters grading. Resolves with what each side received.
async function toGrading() {
    const game = await startGame(server, ['ada', 'bob'])
    const { host, players: [ada, bob], roomCode } = game
    ada.emit('player:answer', { roomCode, answerId: 11 })
    await once(ada, 'player:answer_result')
    bob.emit('player:answer', { roomCode, answerId: 12 })
    await once(bob, 'player:answer_result')
    host.emit('host:next', { roomCode })
    await once(ada, 'session:question')
    ada.emit('player:answer', { roomCode, freeTextResponse: 'Oslo' })
    await once(ada, 'player:answer_result')

    const forHost = once(host, 'session:grading_question')
    const forPlayer = once(ada, 'session:grading_question')
    host.emit('host:next', { roomCode })
    return { ...game, hostView: await forHost, playerView: await forPlayer }
}

const leaksKey = view => JSON.stringify(view).match(/is_correct|isCorrect|"points"|graded/)

test('before reveal, players see the answers but not the key, correctness or points', async () => {
    const { playerView } = await toGrading()
    assert.equal(playerView.revealed, false)
    assert.deepEqual(playerView.playerAnswers.map(a => [a.username, a.answerText]), [['ada', '4'], ['bob', '5']])
    assert.deepEqual(playerView.distribution.map(o => [o.text, o.count]), [['4', 1], ['5', 1]])
    assert.equal(leaksKey(playerView), null)
})

test('the host sees everything before reveal', async () => {
    const { hostView } = await toGrading()
    assert.equal(hostView.revealed, false)
    assert.equal(hostView.question.answers.find(a => a.id === 11).is_correct, true)
    assert.equal(hostView.playerAnswers.find(a => a.username === 'ada').isCorrect, true)
    assert.equal(hostView.distribution.find(o => o.id === 11).isCorrect, true)
})

test('after reveal, players get the key and the results', async () => {
    const { host, players: [ada], roomCode } = await toGrading()
    const revealed = once(ada, 'session:grading_question')
    host.emit('host:reveal', { roomCode })
    const view = await revealed
    assert.equal(view.revealed, true)
    assert.equal(view.question.answers.find(a => a.id === 11).is_correct, true)
    assert.deepEqual(view.playerAnswers.map(a => [a.username, a.points]), [['ada', 1], ['bob', 0]])
    assert.equal(view.distribution.find(o => o.id === 11).isCorrect, true)
})

test('reveal resets for the next question', async () => {
    const { host, players: [ada], roomCode } = await toGrading()
    host.emit('host:reveal', { roomCode })
    await once(ada, 'session:grading_question')
    const next = once(ada, 'session:grading_question')
    host.emit('host:grading_next', { roomCode })
    const view = await next
    assert.equal(view.revealed, false)
    assert.equal(leaksKey(view), null)
})

test('grading free text before reveal does not leak the verdict to players', async () => {
    const { host, players: [ada], roomCode } = await toGrading()
    host.emit('host:grading_next', { roomCode })
    const { playerAnswers } = await once(host, 'session:grading_question')
    const adaId = playerAnswers.find(a => a.username === 'ada').socketId

    const playerUpdate = once(ada, 'session:grading_question')
    const leakedEvent = never(ada, 'session:answer_graded')
    host.emit('host:grade', { roomCode, playerId: adaId, isCorrect: true })
    assert.equal(leaksKey(await playerUpdate), null)
    assert.ok(await leakedEvent)
})

test('a player cannot reveal', async () => {
    const { players: [ada], roomCode } = await toGrading()
    ada.emit('host:reveal', { roomCode })
    const err = await once(ada, 'error')
    assert.match(err.message, /ikke tilgang/i)
})
