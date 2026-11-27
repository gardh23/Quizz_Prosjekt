const { test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, fakeDb, once, startGame } = require('./helpers')

let server
afterEach(async () => { await server.close() })

const sleep = ms => new Promise(r => setTimeout(r, ms))
const titleOf = (titles, id) => titles.find(t => t.id === id)

const quiz = [
    {
        id: 1, type: 'multiple_choice', text: 'Hva er 2+2?', time_limit: 20, order_index: 0,
        answers: [{ id: 11, question_id: 1, text: '4', is_correct: true }, { id: 12, question_id: 1, text: '5', is_correct: false }]
    },
    {
        id: 2, type: 'multiple_choice', text: 'Hva er 3+3?', time_limit: 20, order_index: 1,
        answers: [{ id: 21, question_id: 2, text: '6', is_correct: true }, { id: 22, question_id: 2, text: '7', is_correct: false }]
    },
    {
        id: 3, type: 'free_text', text: 'Hovedstaden i Norge?', time_limit: 20, order_index: 2,
        answers: [{ id: 31, question_id: 3, text: 'Oslo', is_correct: true }]
    },
    {
        id: 4, type: 'number_estimate', text: 'Hundre?', time_limit: 20, order_index: 3,
        answers: [{ id: 41, question_id: 4, text: '100', is_correct: true }]
    }
]

async function answer(player, roomCode, payload) {
    player.emit('player:answer', { roomCode, ...payload })
    await once(player, 'player:answer_result')
}

// Free text is left ungraded, so it scores 0 for everyone.
//        Q1 (MC)   Q2 (MC)   Q3 (free text)          Q4 (estimate 100)
// ada    right     wrong     "x" "y" "y" "x" (2 ch.)  100 (exact)
// bob    wrong     right     "Oslo"                   50 (50 % off)
// cid    wrong     wrong     no answer                10 (90 % off), always last
async function playQuiz() {
    server = await startServer({ db: fakeDb(quiz) })
    const { host, players: [ada, bob, cid], roomCode } = await startGame(server, ['ada', 'bob', 'cid'])
    const next = async () => {
        const question = once(ada, 'session:question')
        host.emit('host:next', { roomCode })
        await question
    }

    await answer(ada, roomCode, { answerId: 11 })
    await answer(bob, roomCode, { answerId: 12 })
    await sleep(200)
    await answer(cid, roomCode, { answerId: 12 })

    await next()
    await answer(ada, roomCode, { answerId: 22 })
    await answer(bob, roomCode, { answerId: 21 })
    await sleep(200)
    await answer(cid, roomCode, { answerId: 22 })

    await next()
    for (const text of ['x', 'y', 'y', 'x']) await answer(ada, roomCode, { freeTextResponse: text })
    await answer(bob, roomCode, { freeTextResponse: 'Oslo' })

    await next()
    await answer(ada, roomCode, { numberResponse: 100 })
    await answer(bob, roomCode, { numberResponse: 50 })
    await sleep(200)
    await answer(cid, roomCode, { numberResponse: 10 })

    const grading = once(host, 'session:grading_question')
    host.emit('host:next', { roomCode })
    await grading
    const finished = once(host, 'session:finished')
    host.emit('host:end', { roomCode })
    return (await finished).titles
}

test('the new titles go to whoever earned them', async () => {
    const titles = await playQuiz()
    const expected = {
        lone_wolf: [['ada'], 'Alene om 2 riktige'],
        unsure_timmy: [['ada'], 'Endret svaret 2 ganger'],
        stone_cold: [['cid'], '4 feil på rad'],
        slowbro: [['cid'], null],
        jon_snow: [['cid'], 'Ingen riktige'],
        npc: [['cid'], 'Fulgte flertallet 2 ganger'],
        stormtrooper: [['cid'], '90 % unna i snitt']
    }
    for (const [id, [winners, detail]] of Object.entries(expected)) {
        const title = titleOf(titles, id)
        assert.ok(title, `${id} was awarded`)
        assert.deepEqual(title.winners, winners, id)
        if (detail) assert.equal(title.detail, detail, id)
    }
})

test('a tease title is left out when every player would share it', async () => {
    server = await startServer()
    const { host, players: [ada, bob], roomCode } = await startGame(server, ['ada', 'bob'])
    await answer(ada, roomCode, { answerId: 12 })
    await answer(bob, roomCode, { answerId: 12 })
    host.emit('host:end', { roomCode })
    await once(host, 'session:grading_question')
    const finished = once(host, 'session:finished')
    host.emit('host:end', { roomCode })
    const { titles } = await finished
    assert.equal(titleOf(titles, 'jon_snow'), undefined, 'both have 0 right')
    assert.equal(titleOf(titles, 'npc'), undefined, 'two players have no majority to follow')
})

test('an identical free-text resubmission is not a change', async () => {
    server = await startServer()
    const { host, players: [ada, bob], roomCode } = await startGame(server, ['ada', 'bob'])
    const next = once(ada, 'session:question')
    host.emit('host:next', { roomCode })
    await next
    for (const text of ['Oslo', 'Oslo', 'Oslo']) await answer(ada, roomCode, { freeTextResponse: text })
    await answer(bob, roomCode, { freeTextResponse: 'Oslo' })
    host.emit('host:end', { roomCode })
    await once(host, 'session:grading_question')
    const finished = once(host, 'session:finished')
    host.emit('host:end', { roomCode })
    const { titles } = await finished
    assert.equal(titleOf(titles, 'unsure_timmy'), undefined)
})
