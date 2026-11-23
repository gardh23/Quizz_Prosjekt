const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, fakeDb, once, startGame } = require('./helpers')

let server
afterEach(async () => { await server.close() })

const sleep = ms => new Promise(r => setTimeout(r, ms))

const quiz = [
    {
        id: 1, type: 'multiple_choice', text: 'Hva er 2+2?', time_limit: 20, order_index: 0,
        answers: [{ id: 11, question_id: 1, text: '4', is_correct: true }, { id: 12, question_id: 1, text: '5', is_correct: false }]
    },
    {
        id: 3, type: 'multiple_choice', text: 'Hva er 3+3?', time_limit: 20, order_index: 1,
        answers: [{ id: 31, question_id: 3, text: '6', is_correct: true }, { id: 32, question_id: 3, text: '7', is_correct: false }]
    },
    {
        id: 2, type: 'number_estimate', text: 'Mount Everest?', time_limit: 20, order_index: 2,
        answers: [{ id: 21, question_id: 2, text: '8849', is_correct: true }]
    }
]

// ada: right, right, exact. bob (always ~150ms slower): wrong, right, 21% off (1 point).
async function playQuiz() {
    server = await startServer({ db: fakeDb(quiz) })
    const game = await startGame(server, ['ada', 'bob'])
    const { host, players: [ada, bob], roomCode } = game
    const answers = [[{ answerId: 11 }, { answerId: 12 }], [{ answerId: 31 }, { answerId: 31 }], [{ numberResponse: 8849 }, { numberResponse: 7000 }]]
    for (const [i, [a, b]] of answers.entries()) {
        if (i > 0) {
            const next = once(ada, 'session:question')
            host.emit('host:next', { roomCode })
            await next
        }
        ada.emit('player:answer', { roomCode, ...a })
        await once(ada, 'player:answer_result')
        await sleep(150)
        bob.emit('player:answer', { roomCode, ...b })
        await once(bob, 'player:answer_result')
    }
    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    const { playerAnswers } = await grading
    return { ...game, ids: Object.fromEntries(playerAnswers.map(p => [p.username, p.socketId])) }
}

async function finish(host, roomCode) {
    const finished = once(host, 'session:finished')
    host.emit('host:end', { roomCode })
    return finished
}

const titleOf = (titles, id) => titles.find(t => t.id === id)

test('the leaderboard counts answers that scored, out of the questions asked', async () => {
    const { host, roomCode } = await playQuiz()
    const { leaderboard } = await finish(host, roomCode)
    assert.deepEqual(leaderboard.map(p => [p.username, p.correct, p.total]), [['ada', 3, 3], ['bob', 2, 3]])
})

test('titles go to whoever earned them', async () => {
    const { host, roomCode } = await playQuiz()
    const { titles } = await finish(host, roomCode)
    assert.deepEqual(titleOf(titles, 'fastest').winners, ['ada'])
    assert.deepEqual(titleOf(titles, 'streak').winners, ['ada'])
    assert.match(titleOf(titles, 'streak').detail, /3 på rad/)
    assert.deepEqual(titleOf(titles, 'sharpshooter').winners, ['ada'])
    assert.equal(titleOf(titles, 'toughest'), undefined, 'no negative points were given')
})

test('the toughest-evening title goes to the player given the most negative points', async () => {
    const { host, roomCode, ids } = await playQuiz()
    const update = once(host, 'session:grading_question')
    host.emit('host:set_points', { roomCode, playerId: ids.bob, points: -2 })
    await update
    const { leaderboard, titles } = await finish(host, roomCode)
    assert.deepEqual(titleOf(titles, 'toughest').winners, ['bob'])
    assert.match(titleOf(titles, 'toughest').detail, /-2/)
    assert.equal(leaderboard.find(p => p.username === 'bob').correct, 2, 'a negative score does not count as correct')
})

test('titles nobody earned are left out', async () => {
    server = await startServer()
    const { host, players: [ada], roomCode } = await startGame(server, ['ada'])
    ada.emit('player:answer', { roomCode, answerId: 12 })
    await once(ada, 'player:answer_result')
    host.emit('host:end', { roomCode })
    await once(host, 'session:grading_question')
    const { titles } = await finish(host, roomCode)
    assert.deepEqual(titles, [])
})
