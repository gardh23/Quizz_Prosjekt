// End-of-quiz results: the leaderboard plus fun titles. A title is shown only when someone
// earned it, and ties share it. To add a title, add an entry to `titles`: `score` returns a
// number for a player (or null when they do not qualify), `best` says whether lower or higher
// wins, and `detail` describes the winning value. `minEntries` needs that many players with a
// score, so one player cannot win both ends of a scale. A `tease` title is left out when only one
// person plays or when every player would share it.

const formatSeconds = ms => `${(ms / 1000).toFixed(1).replace('.', ',')} sek i snitt`
const times = n => n === 1 ? '1 gang' : `${n} ganger`

const CHOICE_TYPES = new Set(['multiple_choice', 'true_false'])

const titles = [
    {
        id: 'fastest',
        emoji: '⚡',
        title: 'Raskest',
        best: 'lowest',
        score: s => s.scoredTimes.length ? average(s.scoredTimes) : null,
        detail: formatSeconds
    },
    {
        id: 'streak',
        emoji: '🔥',
        title: 'Lengste rekke',
        best: 'highest',
        score: s => s.longestStreak >= 2 ? s.longestStreak : null,
        detail: n => `${n} på rad`
    },
    {
        id: 'sharpshooter',
        emoji: '🎯',
        title: 'Skarpskytter',
        best: 'lowest',
        score: s => s.estimateOffs.length ? Math.round(average(s.estimateOffs)) : null,
        detail: pct => pct === 0 ? 'Eksakt på tallestimatene' : `${pct} % unna i snitt`
    },
    {
        // Only negative points the host handed out; there is no title if none were given.
        id: 'toughest',
        emoji: '🫠',
        title: 'Tøffeste kveld',
        best: 'lowest',
        score: s => s.negativePoints < 0 ? s.negativePoints : null,
        detail: n => `Fikk ${n} poeng av hosten`
    },
    {
        id: 'lone_wolf',
        emoji: '🦄',
        title: 'Ensom ulv',
        best: 'highest',
        score: s => s.loneCorrect >= 1 ? s.loneCorrect : null,
        detail: n => n === 1 ? 'Alene om 1 riktig' : `Alene om ${n} riktige`
    },
    {
        id: 'unsure_timmy',
        emoji: '😨',
        title: 'Usikre Timmy',
        best: 'highest',
        tease: true,
        score: s => s.changes >= 1 ? s.changes : null,
        detail: n => `Endret svaret ${times(n)}`
    },
    {
        id: 'stone_cold',
        emoji: '🥶',
        title: 'Stone Cold Steve Austin',
        best: 'highest',
        tease: true,
        score: s => s.longestWrongStreak >= 2 ? s.longestWrongStreak : null,
        detail: n => `${n} feil på rad`
    },
    {
        id: 'slowbro',
        emoji: '🐌',
        title: 'Slowbro',
        best: 'highest',
        tease: true,
        minEntries: 2,
        score: s => s.answerTimes.length ? average(s.answerTimes) : null,
        detail: formatSeconds
    },
    {
        id: 'jon_snow',
        emoji: '❄️',
        title: 'Jon Snow',
        best: 'lowest',
        tease: true,
        score: s => s.correct,
        detail: n => n === 0 ? 'Ingen riktige' : n === 1 ? 'Bare 1 riktig' : `Bare ${n} riktige`
    },
    {
        id: 'npc',
        emoji: '🤖',
        title: 'NPC',
        best: 'highest',
        tease: true,
        score: s => s.followedMajority >= 1 ? s.followedMajority : null,
        detail: n => `Fulgte flertallet ${times(n)}`
    },
    {
        id: 'stormtrooper',
        emoji: '💥',
        title: 'Stormtrooper',
        best: 'highest',
        tease: true,
        minEntries: 2,
        score: s => s.estimateOffs.length ? Math.round(average(s.estimateOffs)) : null,
        detail: pct => `${pct} % unna i snitt`
    }
]

function average(values) {
    return values.reduce((a, b) => a + b, 0) / values.length
}

// Facts about one question that depend on every player's answer. The majority option is the
// single most chosen one; a tie for most chosen means there is no majority to follow.
function questionContext(question, players) {
    const answers = players.map(p => p.answers[question.id]).filter(Boolean)
    const context = { scorers: answers.filter(a => a.points > 0).length, majorityId: null }
    if (players.length >= 3 && CHOICE_TYPES.has(question.type)) {
        const counts = new Map()
        for (const a of answers) {
            if (a.answerId != null) counts.set(a.answerId, (counts.get(a.answerId) || 0) + 1)
        }
        const [first, second] = [...counts.entries()].sort((a, b) => b[1] - a[1])
        if (first && (!second || first[1] > second[1])) context.majorityId = first[0]
    }
    return context
}

// An answer counts as correct when it scored more than 0 (partial credit and host points included).
// An unanswered question counts as wrong.
function playerStats(player, questions, contexts, playerCount) {
    const stats = {
        correct: 0, longestStreak: 0, longestWrongStreak: 0, scoredTimes: [], answerTimes: [],
        estimateOffs: [], negativePoints: 0, loneCorrect: 0, changes: 0, followedMajority: 0
    }
    let streak = 0
    let wrongStreak = 0
    for (const [i, question] of questions.entries()) {
        const ans = player.answers[question.id]
        const context = contexts[i]
        const scored = !!ans && ans.points > 0
        if (scored) {
            stats.correct++
            streak++
            wrongStreak = 0
            stats.longestStreak = Math.max(stats.longestStreak, streak)
            if (Number.isFinite(ans.timeUsed)) stats.scoredTimes.push(ans.timeUsed)
            if (playerCount >= 2 && context.scorers === 1) stats.loneCorrect++
        } else {
            streak = 0
            wrongStreak++
            stats.longestWrongStreak = Math.max(stats.longestWrongStreak, wrongStreak)
        }
        if (ans && Number.isFinite(ans.timeUsed)) stats.answerTimes.push(ans.timeUsed)
        if (ans) stats.changes += ans.changes || 0
        if (ans && context.majorityId !== null && ans.answerId === context.majorityId) stats.followedMajority++
        if (ans && question.type === 'number_estimate' && Number.isFinite(ans.percentOff)) {
            stats.estimateOffs.push(ans.percentOff)
        }
        if (ans && ans.points < 0) stats.negativePoints += ans.points
    }
    return stats
}

function buildResults(session) {
    const players = Object.values(session.players)
    const contexts = session.questions.map(q => questionContext(q, players))
    const statsByName = new Map(players.map(p => [p.username, playerStats(p, session.questions, contexts, players.length)]))

    const sorted = [...players].sort((a, b) => b.score - a.score)
    // Ties share a place and the next place is skipped (1, 1, 3).
    const leaderboard = sorted.map(p => ({
        username: p.username,
        score: p.score,
        rank: 1 + sorted.filter(other => other.score > p.score).length,
        correct: statsByName.get(p.username).correct,
        total: session.questions.length
    }))

    const awarded = []
    for (const t of titles) {
        const scored = players
            .map(p => ({ username: p.username, value: t.score(statsByName.get(p.username)) }))
            .filter(e => e.value !== null)
        if (scored.length < (t.minEntries || 1)) continue
        const values = scored.map(e => e.value)
        const bestValue = t.best === 'lowest' ? Math.min(...values) : Math.max(...values)
        const winners = scored.filter(e => e.value === bestValue).map(e => e.username)
        if (t.tease && (players.length < 2 || winners.length === players.length)) continue
        awarded.push({ id: t.id, emoji: t.emoji, title: t.title, winners, detail: t.detail(bestValue) })
    }

    return { leaderboard, titles: awarded }
}

module.exports = { buildResults }
